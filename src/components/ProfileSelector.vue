<script setup>
defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  profiles: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <section class="panel-block">
    <h2>用户画像</h2>
    <div class="profile-list">
      <label
        v-for="(profile, key) in profiles"
        :key="key"
        class="profile-option"
        :class="{ active: modelValue === key }"
      >
        <input
          type="radio"
          name="profile"
          :value="key"
          :checked="modelValue === key"
          @change="emit('update:modelValue', key)"
        />
        <span>
          <strong>{{ profile.label }}</strong>
          <small>{{ profile.description }}</small>
        </span>
      </label>
    </div>
  </section>
</template>
