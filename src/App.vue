<script setup>
import { ref } from 'vue'
import DamageCalculator from './views/DamageCalculator.vue'
import RelicBrowser from './views/RelicBrowser.vue'

const tab = ref('calc')
</script>

<template>
  <div class="app">
    <header class="titlebar">
      <div class="brand">
        <span class="logo">◈</span>
        <h1>集成战略 · 伤害计算</h1>
      </div>
      <nav class="tabs">
        <button :class="{ active: tab === 'calc' }" @click="tab = 'calc'">伤害计算</button>
        <button :class="{ active: tab === 'relics' }" @click="tab = 'relics'">藏品库</button>
      </nav>
      <span class="version">v0.2</span>
    </header>

    <DamageCalculator v-if="tab === 'calc'" />
    <RelicBrowser v-else />
  </div>
</template>

<style scoped>
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px 20px 20px;
  gap: 14px;
}

.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 20px;
  border-radius: 18px;
  background: linear-gradient(120deg, rgba(168, 85, 247, 0.28), rgba(34, 211, 238, 0.22) 55%, rgba(244, 114, 182, 0.22));
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 32px rgba(99, 102, 241, 0.25), inset 0 0 24px rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(14px);
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo {
  font-size: 20px;
  color: var(--cyan);
  text-shadow: 0 0 12px rgba(34, 211, 238, 0.8);
}

h1 {
  margin: 0;
  font-size: 17px;
  letter-spacing: 2px;
  font-weight: 600;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.tabs button {
  padding: 6px 18px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(8, 12, 20, 0.35);
  color: #c7d2fe;
  cursor: pointer;
  font-size: 13px;
  transition: 0.15s;
}

.tabs button.active {
  background: linear-gradient(90deg, rgba(34, 211, 238, 0.35), rgba(168, 85, 247, 0.35));
  color: #fff;
  border-color: rgba(34, 211, 238, 0.5);
  box-shadow: 0 0 18px rgba(34, 211, 238, 0.35);
}

.version {
  font-size: 12px;
  color: #c7d2fe;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
}
</style>