<template>
  <div class="range">
    <div class="controls" ref="controls">
      <span class="end min" :style="style('min')" tabindex="0" @keyup.left="nudge('min', -1)" @keyup.right="nudge('min', 1)" @pointerdown="down('min', $event)" @pointermove="move('min', $event)" @pointerup="up('min', $event)"></span>
      <!-- <span class="between"></span> -->
      <span class="end max" :style="style('max')" tabindex="0" @keyup.left="nudge('max', -1)" @keyup.right="nudge('max', 1)" @pointerdown="down('max', $event)" @pointermove="move('max', $event)" @pointerup="up('max', $event)"></span>
    </div>
    <div class="labels">
      <ul :style="labelListStyle('min')">
        <li v-for="(choice, i) in choices" :key="choice" :class="labelItemStyle('min', i)">
          {{ choice }}
        </li>
      </ul>
      <div class="between">to</div>
      <ul :style="labelListStyle('max')">
        <li v-for="(choice, i) in choices" :key="choice" :class="labelItemStyle('max', i)">
          {{ choice }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    modelValue: {
      type: Object,
      required: true
    },
    min: {
      type: Number,
      required: true
    },
    max: {
      type: Number,
      required: true
    },
    choices: {
      type: Array,
      required: true
    }
  },
  emits: [ 'update:modelValue' ],
  data() {
    return {
      isDown: false,
      clientWidth: null
    };
  },
  mounted() {
    this.clientWidth = this.$refs.controls.clientWidth;
    this.observer = new ResizeObserver(() => {
      this.clientWidth = this.$refs.controls.clientWidth;
    }).observe(this.$el);
  },
  methods: {
    style(which) {
      const result = {
        left: this.valueToCss(this.modelValue[which])
      }
      return result;
    },
    labelStyle(i) {
      return {
        left: this.valueToCss(i)
      };
    },
    labelListStyle(which) {
      const i = this.modelValue[which];
      return {
        transform: `translate(0, -${i * 2}em)`
      }
    },
    // eslint-disable-next-line
    labelItemStyle(which, i) {
      return {};
    },
    valueToCss(value) {
      return (value - this.min) / (this.max - this.min) * this.clientWidth + 'px';
    },
    nudge(which, delta) {
      let value = this.modelValue[which] + delta;
      value = Math.max(value, this.min);
      value = Math.min(value, this.max);
      value = this.preventCrossover(which, value);
      this.$emit('update:modelValue', {
        ...this.modelValue,
        [which]: value
      });
    },
    down(which, e) {
      if (!e.isPrimary) {
        return;
      }
      this.isDown = true;
      this.startClientX = e.clientX;
      e.target.setPointerCapture(e.pointerId);
    },
    move(which, e) {
      if (!e.isPrimary) {
        return;
      }
      if (!this.isDown) {
        return;
      }
      this.acceptValue(which, e);
    },
    up(which, e) {
      if (!e.isPrimary) {
        return;
      }
      this.isDown = false;
      this.acceptValue(which, e);
    },
    preventCrossover(which, value) {
      if (which === 'min') {
        if (value >= this.modelValue.max) {
          value = this.modelValue.max - 1;
        }
      } else if (which === 'max') {
        if (value <= this.modelValue.min) {
          value = this.modelValue.min + 1;
        }
      }
      return value;
    },
    acceptValue(which, e) {
      const offset = e.target.parentNode.getBoundingClientRect().x;
      let value = Math.round((e.clientX - offset) / this.clientWidth * (this.max - this.min) + this.min);
      value = Math.max(value, this.min);
      value = Math.min(value, this.max);
      value = this.preventCrossover(which, value);
      this.$emit('update:modelValue', {
        ...this.modelValue,
        [which]: value
      });
    }
  }
};
</script>
<style scoped>
  .range {
    width: 100%;
    display: block;
  }
  .controls {
    position: relative;
    height: 2em;
    margin: auto;
    width: calc(100% - 2em);
  }
  .controls .end {
    position: absolute;
    width: 1em;
    border: 1px solid #eee;
    border-radius: 0.5em;
    background-color: blue;
    transform: translate(-50%);
  }
  .controls .between {
    position: absolute;
  }
  .labels {
    height: 1.5em;
    overflow: hidden;
    display: flex;
    justify-content: space-between;
  }
  .labels ul {
    padding: 0;
    margin: 0;
    transition: transform 0.25s;
  }
  .labels li {
    height: 2em;
    list-style: none;
  }
</style>
