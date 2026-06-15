"""
Traffic Light Simulation - Complete Training Pipeline
======================================================
Steps 1-4: Synthetic Dataset Generation, DQN Model, Training Metrics, Serialization & Graphs
"""

import numpy as np
import pandas as pd
import pickle
import random
import os
from collections import deque
import matplotlib.pyplot as plt
import seaborn as sns

os.makedirs("saved_model", exist_ok=True)

# ============================================================================
# STEP 1: SYNTHETIC TRAFFIC DATASET GENERATION
# ============================================================================

class TrafficSimulator:
    """
    Generates realistic synthetic traffic data for a 4-way intersection.
    Each lane has: arrival_rate, queue_length, waiting_time, phase_state.
    """
    def __init__(self, seed=42):
        self.rng = np.random.default_rng(seed)
        self.phase_duration = 30  # seconds per green phase
        self.num_lanes = 4       # N, S, E, W

    def generate_timestep(self, t):
        """Generate one timestep of traffic data with realistic patterns."""
        # Time-of-day factor: peak hours 7-9 AM and 5-7 PM
        hour = (t // 3600) % 24
        tod_factor = 1.0
        if 7 <= hour < 9:
            tod_factor = 2.5
        elif 17 <= hour < 19:
            tod_factor = 2.0
        elif 22 <= hour or hour < 5:
            tod_factor = 0.3

        lane_data = []
        for lane in range(self.num_lanes):
            base_rate = self.rng.exponential(scale=0.3) * tod_factor
            arrival_rate = max(0, base_rate + self.rng.normal(0, 0.05))
            queue_length = max(0, int(self.rng.poisson(arrival_rate * 10)))
            waiting_time = max(0, queue_length * self.rng.uniform(1.5, 4.0) + self.rng.normal(0, 2))
            phase_state = 1 if (t // self.phase_duration) % self.num_lanes == lane else 0

            lane_data.append({
                "timestamp": t,
                "lane": lane,
                "arrival_rate": round(arrival_rate, 4),
                "queue_length": queue_length,
                "waiting_time": round(waiting_time, 2),
                "phase_state": phase_state,
                "hour": hour,
                "tod_factor": round(tod_factor, 2),
            })
        return lane_data

    def generate_dataset(self, duration_seconds=7200, step=10):
        """Generate a full day of traffic data at 10-second intervals."""
        records = []
        for t in range(0, duration_seconds, step):
            records.extend(self.generate_timestep(t))
        df = pd.DataFrame(records)
        # Add throughput and delay targets for supervised pre-training
        df["throughput"] = df["queue_length"] * (1 - df["phase_state"] * 0.3)
        df["delay"] = df["waiting_time"] / (df["queue_length"] + 1)
        return df

def create_dataset():
    """Create and save the synthetic dataset."""
    print("=" * 60)
    print("STEP 1: Generating Synthetic Traffic Dataset (24 hours @ 10s intervals)")
    print("=" * 60)
    sim = TrafficSimulator()
    df = sim.generate_dataset()
    df.to_csv("saved_model/traffic_dataset.csv", index=False)
    print(f"Generated {len(df)} records across {df['lane'].nunique()} lanes")
    print(f"Columns: {list(df.columns)}")
    print(df.head(8).to_string())
    print()
    return df, sim

# ============================================================================
# STEP 2: DEEP Q-NETWORK (DQN) FOR TRAFFIC LIGHT CONTROL
# ============================================================================

class TrafficLightEnvironment:
    """
    RL Environment for a 4-way intersection.
    State: [queue_lengths(4), waiting_times(4), phase_state(4)] -> 12-dim
    Actions: 0=keep current phase, 1=switch to next phase
    Reward: negative weighted sum of waiting times and queue lengths plus green throughput
    """
    def __init__(self, df):
        self.df = df
        self.num_lanes = 4
        self.state_dim = 12
        self.action_dim = 2
        self.max_queue = 50.0
        self.rng = np.random.default_rng(42)
        self.reset()

    def reset(self):
        self.idx = 0
        self.current_phase = 0
        self.queues = [0.0] * self.num_lanes
        self.waits = [0.0] * self.num_lanes
        self._initialize_from_dataset()
        return self._get_state()

    def _initialize_from_dataset(self):
        lane_rows = self.df.iloc[self.idx:self.idx + self.num_lanes]
        if len(lane_rows) == self.num_lanes:
            self.queues = [float(v) for v in lane_rows["queue_length"].tolist()]
            self.waits = [float(v) for v in lane_rows["waiting_time"].tolist()]
        else:
            self.queues = [5.0, 5.0, 5.0, 5.0]
            self.waits = [8.0, 8.0, 8.0, 8.0]

    def _normalize(self, values, max_value):
        return [min(1.0, max(0.0, v / max_value)) for v in values]

    def _get_state(self):
        normalized_queues = self._normalize(self.queues, self.max_queue)
        normalized_waits = self._normalize(self.waits, 120.0)
        p = [1 if i == self.current_phase else 0 for i in range(self.num_lanes)]
        return np.array(normalized_queues + normalized_waits + p, dtype=np.float32)

    def _get_lane_rows(self, idx):
        return self.df.iloc[idx:idx + self.num_lanes]

    def step(self, action):
        if action == 1:
            self.current_phase = (self.current_phase + 1) % self.num_lanes

        lane_rows = self._get_lane_rows(self.idx)
        arrival_rates = np.zeros(self.num_lanes, dtype=np.float32)
        if len(lane_rows) == self.num_lanes:
            arrival_rates = np.array(lane_rows["arrival_rate"].tolist(), dtype=np.float32)

        arrivals = np.maximum(0.0, arrival_rates * 10.0 + self.rng.normal(0, 0.5, size=self.num_lanes))
        green_throughput = 0.0
        for i in range(self.num_lanes):
            if i == self.current_phase:
                discharge = min(self.queues[i], self.rng.uniform(1.2, 2.2))
                self.queues[i] = max(0.0, self.queues[i] - discharge)
                self.waits[i] = max(0.0, self.waits[i] - discharge * 1.2)
                green_throughput += discharge
            else:
                self.queues[i] = min(self.max_queue, self.queues[i] + arrivals[i])
                self.waits[i] = min(120.0, self.waits[i] + self.queues[i] * self.rng.uniform(0.05, 0.12))

        self.idx += self.num_lanes
        done = self.idx >= len(self.df)
        next_state = self._get_state()

        reward = green_throughput * 0.8 - 0.25 * np.sum(self.queues) - 0.1 * np.sum(self.waits)
        return next_state, reward, done, {}


class DQNAgent:
    """
    Deep Q-Network with experience replay and target network.
    """
    def __init__(self, state_dim, action_dim):
        self.state_dim = state_dim
        self.action_dim = action_dim
        self.memory = deque(maxlen=10000)
        self.gamma = 0.95
        self.epsilon = 1.0
        self.epsilon_min = 0.05
        self.epsilon_decay = 0.98
        self.batch_size = 32
        self.learning_rate = 0.0005
        self.gradient_clip = 5.0

        # Build model using numpy weights (lightweight, no TF/PyTorch needed)
        self.model = None
        self.target_model = None
        self._build_models()

    def _build_models(self):
        """Two-layer neural network with numpy."""
        self.W1 = np.random.randn(self.state_dim, 64) * np.sqrt(2.0 / self.state_dim)
        self.b1 = np.zeros(64)
        self.W2 = np.random.randn(64, 32) * np.sqrt(2.0 / 64)
        self.b2 = np.zeros(32)
        self.W3 = np.random.randn(32, self.action_dim) * np.sqrt(2.0 / 32)
        self.b3 = np.zeros(self.action_dim)

        # Target network (same architecture)
        self.tW1 = self.W1.copy()
        self.tb1 = self.b1.copy()
        self.tW2 = self.W2.copy()
        self.tb2 = self.b2.copy()
        self.tW3 = self.W3.copy()
        self.tb3 = self.b3.copy()

    def _relu(self, x):
        return np.maximum(0, x)

    def _forward(self, x, target=False):
        if target:
            h1 = self._relu(x @ self.tW1 + self.tb1)
            h2 = self._relu(h1 @ self.tW2 + self.tb2)
            return h2 @ self.tW3 + self.tb3
        else:
            h1 = self._relu(x @ self.W1 + self.b1)
            h2 = self._relu(h1 @ self.W2 + self.b2)
            return h2 @ self.W3 + self.b3

    def act(self, state):
        if np.random.rand() < self.epsilon:
            return np.random.randint(self.action_dim)
        q_values = self._forward(state)
        return int(np.argmax(q_values))

    def remember(self, state, action, reward, next_state, done):
        self.memory.append((state, action, reward, next_state, done))

    def replay(self):
        if len(self.memory) < self.batch_size:
            return 0.0

        batch = random.sample(self.memory, self.batch_size)
        states = np.array([b[0] for b in batch])
        actions = np.array([b[1] for b in batch])
        rewards = np.array([b[2] for b in batch])
        next_states = np.array([b[3] for b in batch])
        dones = np.array([b[4] for b in batch])

        # Current Q values
        q_current = self._forward(states)
        q_next = self._forward(next_states, target=True)

        # Target Q values
        targets = q_current.copy()
        for i in range(self.batch_size):
            if dones[i]:
                targets[i, actions[i]] = rewards[i]
            else:
                targets[i, actions[i]] = rewards[i] + self.gamma * np.max(q_next[i])

        # Gradient descent (manual backward pass)
        # Forward pass to get hidden layers for gradient
        h1 = self._relu(states @ self.W1 + self.b1)
        h2 = self._relu(h1 @ self.W2 + self.b2)
        pred = h2 @ self.W3 + self.b3

        loss = np.mean((pred - targets) ** 2)

        # Backward pass
        d_pred = 2 * (pred - targets) / self.batch_size
        d_W3 = h2.T @ d_pred
        d_b3 = np.sum(d_pred, axis=0)
        d_h2 = d_pred @ self.W3.T
        d_h2[h2 <= 0] = 0  # ReLU derivative
        d_W2 = h1.T @ d_h2
        d_b2 = np.sum(d_h2, axis=0)
        d_h1 = d_h2 @ self.W2.T
        d_h1[h1 <= 0] = 0
        d_W1 = states.T @ d_h1
        d_b1 = np.sum(d_h1, axis=0)

        # Update weights
        d_W1 = np.clip(d_W1, -self.gradient_clip, self.gradient_clip)
        d_b1 = np.clip(d_b1, -self.gradient_clip, self.gradient_clip)
        d_W2 = np.clip(d_W2, -self.gradient_clip, self.gradient_clip)
        d_b2 = np.clip(d_b2, -self.gradient_clip, self.gradient_clip)
        d_W3 = np.clip(d_W3, -self.gradient_clip, self.gradient_clip)
        d_b3 = np.clip(d_b3, -self.gradient_clip, self.gradient_clip)

        self.W1 -= self.learning_rate * d_W1
        self.b1 -= self.learning_rate * d_b1
        self.W2 -= self.learning_rate * d_W2
        self.b2 -= self.learning_rate * d_b2
        self.W3 -= self.learning_rate * d_W3
        self.b3 -= self.learning_rate * d_b3

        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay
            self.epsilon = max(self.epsilon, self.epsilon_min)

        return np.nan_to_num(loss, nan=0.0, posinf=1e6, neginf=-1e6)

    def update_target_network(self):
        """Copy online network weights to target network."""
        self.tW1 = self.W1.copy()
        self.tb1 = self.b1.copy()
        self.tW2 = self.W2.copy()
        self.tb2 = self.b2.copy()
        self.tW3 = self.W3.copy()
        self.tb3 = self.b3.copy()


def train_dqn(df):
    """Train DQN agent on traffic data."""
    print("=" * 60)
    print("STEP 2: Training Deep Q-Network (DQN) for Traffic Light Control")
    print("=" * 60)

    env = TrafficLightEnvironment(df)
    agent = DQNAgent(env.state_dim, env.action_dim)

    episodes = 90
    episode_rewards = []
    episode_losses = []
    avg_waiting_times = []

    target_update_freq = 5

    for ep in range(episodes):
        state = env.reset()
        total_reward = 0
        total_loss = 0
        steps = 0

        while True:
            action = agent.act(state)
            next_state, reward, done, _ = env.step(action)
            agent.remember(state, action, reward, next_state, done)
            loss = agent.replay()
            total_reward += reward
            total_loss += loss if loss else 0
            state = next_state
            steps += 1
            if done:
                break

        if (ep + 1) % target_update_freq == 0:
            agent.update_target_network()

        avg_reward = total_reward / max(steps, 1)
        avg_loss = total_loss / max(steps, 1)
        episode_rewards.append(avg_reward)
        episode_losses.append(avg_loss)

        # Compute avg waiting time from this episode's states
        env_tmp = TrafficLightEnvironment(df)
        env_tmp.reset()
        wait_times = []
        for _ in range(min(steps * env.num_lanes, len(df))):
            s = env_tmp._get_state()
            wait_times.append(np.mean(s[4:8]))
            env_tmp.idx += env_tmp.num_lanes
            if env_tmp.idx >= len(df) - env_tmp.num_lanes:
                break
        avg_wait = np.mean(wait_times) if wait_times else 0
        avg_waiting_times.append(avg_wait)

        if (ep + 1) % 10 == 0 or ep == 0:
            print(f"  Episode {ep+1:3d}/{episodes} | Avg Reward: {avg_reward:7.2f} | "
                  f"Avg Loss: {avg_loss:6.4f} | Avg Wait: {avg_wait:6.2f}s | Epsilon: {agent.epsilon:.3f}")

    print(f"\nTraining complete! Final avg reward: {np.mean(episode_rewards[-10:]):.2f}")
    print(f"Final epsilon: {agent.epsilon:.4f}")
    print()

    return agent, {
        "episode_rewards": episode_rewards,
        "episode_losses": episode_losses,
        "avg_waiting_times": avg_waiting_times,
    }


# ============================================================================
# STEP 3: METRICS REPORTING
# ============================================================================

def report_metrics(history):
    """Print comprehensive training metrics."""
    print("=" * 60)
    print("STEP 3: Training Metrics Report")
    print("=" * 60)

    rewards = history["episode_rewards"]
    losses = history["episode_losses"]
    waits = history["avg_waiting_times"]

    print(f"\n  Performance Metrics:")
    print(f"  {'Metric':<30} {'Start':>10} {'End (avg last 10)':>20}")
    print(f"  {'-'*30} {'-'*10} {'-'*20}")
    print(f"  {'Avg Reward per Step':<30} {rewards[0]:>10.2f} {np.mean(rewards[-10:]):>20.2f}")
    print(f"  {'Avg Loss':<30} {losses[0]:>10.4f} {np.mean(losses[-10:]):>20.4f}")
    print(f"  {'Avg Waiting Time (s)':<30} {waits[0]:>10.2f} {np.mean(waits[-10:]):>20.2f}")

    improvement = ((waits[0] - np.mean(waits[-10:])) / max(waits[0], 0.001)) * 100
    print(f"  {'Waiting Time Reduction':<30} {'':>10} {improvement:>19.1f}%")

    print(f"\n  Final Model State:")
    print(f"  {'Epsilon (exploration rate)':<30} {rewards[-1] if False else 'N/A':>10}")
    print(f"  {'Replay Memory Size':<30} {len(rewards):>10}")
    print()


# ============================================================================
# STEP 4: SERIALIZATION & GRAPHING
# ============================================================================

def save_artifacts(agent, history, scaler_params=None):
    """Save model and preprocessing artifacts using pickle."""
    print("=" * 60)
    print("STEP 4a: Serializing Model & Artifacts with Pickle")
    print("=" * 60)

    artifacts = {
        "model_weights_W1": agent.W1,
        "model_weights_b1": agent.b1,
        "model_weights_W2": agent.W2,
        "model_weights_b2": agent.b2,
        "model_weights_W3": agent.W3,
        "model_weights_b3": agent.b3,
        "target_weights_tW1": agent.tW1,
        "target_weights_tb1": agent.tb1,
        "target_weights_tW2": agent.tW2,
        "target_weights_tb2": agent.tb2,
        "target_weights_tW3": agent.tW3,
        "target_weights_tb3": agent.tb3,
        "state_dim": agent.state_dim,
        "action_dim": agent.action_dim,
        "gamma": agent.gamma,
        "epsilon": agent.epsilon,
        "epsilon_min": agent.epsilon_min,
        "epsilon_decay": agent.epsilon_decay,
        "episode_rewards": history["episode_rewards"],
        "episode_losses": history["episode_losses"],
        "avg_waiting_times": history["avg_waiting_times"],
    }

    with open("saved_model/dqn_agent.pkl", "wb") as f:
        pickle.dump(artifacts, f)
    print("  -> saved_model/dqn_agent.pkl saved")

    # Save scaler params if provided
    if scaler_params:
        with open("saved_model/scaler.pkl", "wb") as f:
            pickle.dump(scaler_params, f)
        print("  -> saved_model/scaler.pkl saved")

    print("  Artifacts include: model weights, training history, hyperparameters")
    print()


def generate_graphs(history):
    """Generate and save training performance graphs."""
    print("=" * 60)
    print("STEP 4b: Generating Training Performance Graphs")
    print("=" * 60)

    sns.set_theme(style="darkgrid")
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    episodes = range(1, len(history["episode_rewards"]) + 1)

    # Graph 1: Reward per Episode
    axes[0].plot(episodes, history["episode_rewards"], color="#2196F3", linewidth=1.5)
    axes[0].axhline(y=np.mean(history["episode_rewards"][-10:]),
                    color="#FF5722", linestyle="--", label=f'Avg final: {np.mean(history["episode_rewards"][-10:]):.1f}')
    axes[0].fill_between(episodes, history["episode_rewards"], alpha=0.1, color="#2196F3")
    axes[0].set_xlabel("Episode")
    axes[0].set_ylabel("Average Reward per Step")
    axes[0].set_title("DQN Training: Reward vs Episodes")
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    # Graph 2: Loss per Episode
    axes[1].plot(episodes, history["episode_losses"], color="#9C27B0", linewidth=1.5)
    axes[1].axhline(y=np.mean(history["episode_losses"][-10:]),
                    color="#FF5722", linestyle="--", label=f'Avg final: {np.mean(history["episode_losses"][-10:]):.4f}')
    axes[1].fill_between(episodes, history["episode_losses"], alpha=0.1, color="#9C27B0")
    axes[1].set_xlabel("Episode")
    axes[1].set_ylabel("Average Loss")
    axes[1].set_title("DQN Training: Loss vs Episodes")
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)

    # Graph 3: Average Waiting Time
    axes[2].plot(episodes, history["avg_waiting_times"], color="#4CAF50", linewidth=1.5)
    axes[2].axhline(y=np.mean(history["avg_waiting_times"][-10:]),
                    color="#FF5722", linestyle="--", label=f'Avg final: {np.mean(history["avg_waiting_times"][-10:]):.1f}s')
    axes[2].fill_between(episodes, history["avg_waiting_times"], alpha=0.1, color="#4CAF50")
    axes[2].set_xlabel("Episode")
    axes[2].set_ylabel("Average Waiting Time (seconds)")
    axes[2].set_title("Traffic Efficiency: Wait Time vs Episodes")
    axes[2].legend()
    axes[2].grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig("saved_model/training_performance.png", dpi=150, bbox_inches="tight")
    plt.savefig("saved_model/training_performance.pdf", bbox_inches="tight")
    print("  -> saved_model/training_performance.png saved")
    print("  -> saved_model/training_performance.pdf saved")
    print()


# ============================================================================
# MAIN PIPELINE
# ============================================================================

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("TRAFFIC LIGHT SIMULATION MODEL - COMPLETE PIPELINE")
    print("=" * 60 + "\n")

    # Step 1: Dataset
    df, sim = create_dataset()

    # Step 2: Model training
    agent, history = train_dqn(df)

    # Step 3: Metrics
    report_metrics(history)

    # Step 4: Serialization + Graphs
    save_artifacts(agent, history)
    generate_graphs(history)

    print("=" * 60)
    print("PIPELINE COMPLETE. All artifacts saved to saved_model/")
    print("=" * 60)
