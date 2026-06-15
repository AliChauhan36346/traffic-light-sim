"""
FastAPI Backend - Traffic Light Simulation API
===============================================
Step 5: Loads pickled DQN model and serves real-time predictions + simulation states.
"""

import pickle
import numpy as np
import random
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Traffic Light Simulation API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Load pickled model artifacts
# ---------------------------------------------------------------------------
artifacts = None
try:
    with open("saved_model/dqn_agent.pkl", "rb") as f:
        artifacts = pickle.load(f)
    print("[INFO] Model artifacts loaded successfully from saved_model/dqn_agent.pkl")
except FileNotFoundError:
    print("[WARN] No saved model found. Run train_model.py first. Using random fallback.")

# ---------------------------------------------------------------------------
# Helper: forward pass through the trained network
# ---------------------------------------------------------------------------
def relu(x):
    return np.maximum(0, x)

def normalize_state(state_vec):
    """Normalize the queue and waiting time values to match training input scaling."""
    x = np.array(state_vec, dtype=np.float32)
    x[:4] = np.clip(x[:4] / 50.0, 0.0, 1.0)
    x[4:8] = np.clip(x[4:8] / 120.0, 0.0, 1.0)
    return x


def predict_action(state_vec):
    """
    Run a forward pass through the DQN to get Q-values and the best action.
    state_vec: 12-dim array [4 queue lengths, 4 waiting times, 4 phase states]
    Returns: action (0=keep, 1=switch), q_values, predicted_wait_time
    """
    if artifacts is None:
        return random.randint(0, 1), [0.0, 0.0], 15.0  # fallback

    x = normalize_state(state_vec)
    h1 = relu(x @ artifacts["model_weights_W1"] + artifacts["model_weights_b1"])
    h2 = relu(h1 @ artifacts["model_weights_W2"] + artifacts["model_weights_b2"])
    q_values = h2 @ artifacts["model_weights_W3"] + artifacts["model_weights_b3"]

    action = int(np.argmax(q_values))
    # Predicted wait time as a heuristic from state
    pred_wait = float(np.mean(state_vec[4:8]) if len(state_vec) >= 8 else 15.0)
    return action, q_values.tolist(), pred_wait


# ---------------------------------------------------------------------------
# API Models
# ---------------------------------------------------------------------------
class TrafficState(BaseModel):
    queue_lengths: list[float]  # [N, S, E, W]
    waiting_times: list[float]  # [N, S, E, W]
    phase_state: list[int]      # which lane is green [N, S, E, W]

class PredictionResponse(BaseModel):
    action: int
    action_label: str
    q_values: list[float]
    predicted_wait_reduction: float
    phase_state: list[int]

class SimulationState(BaseModel):
    lane_id: int
    queue_length: float
    waiting_time: float
    is_green: bool
    vehicle_count: int
    avg_speed: float

class SimulationConfig(BaseModel):
    arrival_rates: list[float]  # cars per second for [N, S, E, W]
    controller_mode: str = "smart"  # smart or fixed

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/")
def root():
    return {"message": "Traffic Light Simulation API", "status": "running"}

@app.get("/health")
def health():
    model_loaded = artifacts is not None
    metrics = {}
    if model_loaded:
        metrics = {
            "state_dim": artifacts.get("state_dim"),
            "action_dim": artifacts.get("action_dim"),
            "final_avg_reward": round(float(np.mean(artifacts.get("episode_rewards", [0])[-10:])), 4),
            "final_avg_wait": round(float(np.mean(artifacts.get("avg_waiting_times", [0])[-10:])), 2),
        }
    return {"model_loaded": model_loaded, "metrics": metrics}

# ---------------------------------------------------------------------------
# Global Simulation State (Stateful Backend)
# ---------------------------------------------------------------------------
sim_queues = [8.0, 5.0, 12.0, 7.0]
sim_waits = [10.0, 5.0, 20.0, 8.0]
sim_phase = 0  # index of green lane (0=North, 1=South, 2=East, 3=West)
sim_phase_hold = 0  # number of consecutive updates the current phase has been active
sim_pending_phase = None
sim_yellow_remaining = 0
sim_arrival_rates = [0.25, 0.25, 0.25, 0.25]  # cars per second for [N, S, E, W]
sim_controller_mode = "smart"

SIM_STEP_SECONDS = 2
YELLOW_SECONDS = 2
MIN_GREEN_SECONDS = 10
MAX_GREEN_SECONDS = 30
YELLOW_STEPS = max(1, YELLOW_SECONDS // SIM_STEP_SECONDS)
MIN_GREEN_STEPS = max(1, MIN_GREEN_SECONDS // SIM_STEP_SECONDS)
MAX_GREEN_STEPS = max(MIN_GREEN_STEPS + 1, MAX_GREEN_SECONDS // SIM_STEP_SECONDS)
SWITCH_PRESSURE_MARGIN = 1.2


def lane_pressure(queue_length, waiting_time):
    """Higher score means the lane has more need for green time."""
    return queue_length + waiting_time * 0.15


def start_yellow_clearance(next_phase):
    global sim_pending_phase, sim_yellow_remaining
    sim_pending_phase = next_phase
    sim_yellow_remaining = YELLOW_STEPS


def update_environment(signal_states):
    global sim_queues, sim_waits

    for i in range(4):
        state = signal_states[i]
        if state == "green":
            discharge = random.uniform(2.0, 3.2)
            sim_queues[i] = max(0.0, sim_queues[i] - discharge)
            sim_waits[i] = max(0.0, sim_waits[i] - discharge * 1.3)
        elif state == "yellow":
            discharge = random.uniform(0.5, 1.1)
            sim_queues[i] = max(0.0, sim_queues[i] - discharge)
            sim_waits[i] = max(0.0, sim_waits[i] - discharge * 0.6)
        else:
            arrival = max(0.0, random.gauss(sim_arrival_rates[i] * SIM_STEP_SECONDS, 0.2))
            sim_queues[i] = min(50.0, sim_queues[i] + arrival)
            sim_waits[i] = min(120.0, sim_waits[i] + sim_queues[i] * random.uniform(0.06, 0.12))

@app.get("/simulation/current")
def get_current_simulation():
    """Return the running stateful simulation, updated via DQN control."""
    global sim_queues, sim_waits, sim_phase, sim_phase_hold, sim_pending_phase, sim_yellow_remaining

    # 1. Prepare state vector for DQN prediction
    phase_vec = [1 if i == sim_phase else 0 for i in range(4)]
    state_vec = sim_queues + sim_waits + phase_vec

    # 2. Get DQN prediction for visibility. The live controller below enforces
    # realistic traffic constraints and can override weak model decisions.
    action, q_vals, pred_wait = predict_action(state_vec)

    signal_states = ["red"] * 4

    # 3. Yellow clearance before the next road turns green
    if sim_yellow_remaining > 0:
        signal_states[sim_phase] = "yellow"
        action_label = "Yellow Clearance"
        sim_yellow_remaining -= 1
        update_environment(signal_states)
        if sim_yellow_remaining == 0 and sim_pending_phase is not None:
            sim_phase = sim_pending_phase
            sim_pending_phase = None
            sim_phase_hold = 0
    else:
        # 4. Adaptive phase selection
        pressure_scores = [lane_pressure(sim_queues[i], sim_waits[i]) for i in range(4)]
        current_pressure = pressure_scores[sim_phase]
        red_phase = max((i for i in range(4) if i != sim_phase), key=lambda i: pressure_scores[i])
        red_pressure = pressure_scores[red_phase]

        held_min_green = sim_phase_hold >= MIN_GREEN_STEPS
        held_max_green = sim_phase_hold >= MAX_GREEN_STEPS
        loaded_red_lane = red_pressure > current_pressure * SWITCH_PRESSURE_MARGIN
        current_lane_cleared = sim_queues[sim_phase] < 1.5 and red_pressure >= 5.0

        next_phase = sim_phase
        action_label = "Adaptive Hold"
        if sim_controller_mode == "fixed":
            if held_min_green:
                next_phase = (sim_phase + 1) % 4
                action_label = "Fixed Cycle Switch"
            else:
                action_label = "Fixed Cycle Hold"
        elif held_max_green:
            next_phase = red_phase
            action_label = "Adaptive Switch (max green)"
        elif held_min_green and current_lane_cleared:
            next_phase = red_phase
            action_label = "Adaptive Switch (lane cleared)"
        elif held_min_green and loaded_red_lane:
            next_phase = red_phase
            action_label = "Adaptive Switch (higher demand)"
        elif held_min_green and action == 1 and red_pressure > current_pressure:
            next_phase = red_phase
            action_label = "Model-Assisted Switch"

        if next_phase != sim_phase:
            signal_states[sim_phase] = "yellow"
            start_yellow_clearance(next_phase)
            sim_yellow_remaining -= 1
            update_environment(signal_states)
            if sim_yellow_remaining == 0 and sim_pending_phase is not None:
                sim_phase = sim_pending_phase
                sim_pending_phase = None
                sim_phase_hold = 0
        else:
            signal_states[sim_phase] = "green"
            update_environment(signal_states)
            sim_phase_hold += 1

    # Recompute pressure after the environment update for the response.
    pressure_scores = [lane_pressure(sim_queues[i], sim_waits[i]) for i in range(4)]

    # Round values for clean API response
    queues_rounded = [round(q, 1) for q in sim_queues]
    waits_rounded = [round(w, 1) for w in sim_waits]

    # Build lane states
    lanes = []
    for i in range(4):
        direction = ["North", "South", "East", "West"][i]
        lanes.append({
            "lane_id": i,
            "direction": direction,
            "queue_length": queues_rounded[i],
            "waiting_time": waits_rounded[i],
            "is_green": signal_states[i] == "green",
            "signal_state": signal_states[i],
            "vehicle_count": int(max(0, int(sim_queues[i]))),
            "avg_speed": round(random.uniform(25, 45) if signal_states[i] == "green" else 0, 1),
        })

    return {
        "lanes": lanes,
        "phase_state": [1 if signal_states[i] == "green" else 0 for i in range(4)],
        "prediction": {
            "action": action,
            "action_label": action_label,
            "q_values": [round(v, 4) for v in q_vals],
            "predicted_wait_reduction": round(pred_wait, 1),
            "controller": sim_controller_mode,
            "phase_hold_seconds": sim_phase_hold * SIM_STEP_SECONDS,
            "pressure_scores": [round(v, 2) for v in pressure_scores],
        },
        "config": {
            "arrival_rates": [round(v, 2) for v in sim_arrival_rates],
            "controller_mode": sim_controller_mode,
        },
        "timestamp": int(__import__("time").time()),
    }


@app.get("/simulation/config")
def get_simulation_config():
    """Return the current simulation input settings."""
    return {
        "arrival_rates": [round(v, 2) for v in sim_arrival_rates],
        "controller_mode": sim_controller_mode,
        "step_seconds": SIM_STEP_SECONDS,
        "yellow_seconds": YELLOW_SECONDS,
        "min_green_seconds": MIN_GREEN_SECONDS,
        "max_green_seconds": MAX_GREEN_SECONDS,
    }


@app.post("/simulation/config")
def update_simulation_config(config: SimulationConfig):
    """Update traffic arrival rates and controller mode."""
    global sim_arrival_rates, sim_controller_mode

    rates = list(config.arrival_rates[:4])
    while len(rates) < 4:
        rates.append(0.25)

    sim_arrival_rates = [min(5.0, max(0.0, float(rate))) for rate in rates]
    sim_controller_mode = "fixed" if config.controller_mode == "fixed" else "smart"

    return get_simulation_config()


@app.post("/predict")
def predict(state: TrafficState):
    """Predict optimal traffic light action given current state."""
    state_vec = state.queue_lengths + state.waiting_times + list(map(float, state.phase_state))
    action, q_vals, pred_wait = predict_action(state_vec)
    action_label = "Switch Phase" if action == 1 else "Maintain Phase"

    return PredictionResponse(
        action=action,
        action_label=action_label,
        q_values=q_vals,
        predicted_wait_reduction=pred_wait,
        phase_state=state.phase_state,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
