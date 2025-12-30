<template>
  <div class="range">
    <div class="range-controls" ref="controls">
      <span class="between" :style="betweenStyle()"></span>
      <span v-if="double" class="end min" :style="style('min')" tabindex="0" @keydown.left="nudge('min', -1)" @keydown.right="nudge('min', 1)" @pointerdown="down('min', $event)" @pointermove="move('min', $event)" @pointerup="up('min', $event)"></span>
      <span class="end max" :style="style('max')" tabindex="0" @keydown.left="nudge('max', -1)" @keydown.right="nudge('max', 1)" @pointerdown="down('max', $event)" @pointermove="move('max', $event)" @pointerup="up('max', $event)"></span>
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
    <button 
      v-if="isFilterActive" 
      class="range-clear-button" 
      @click="clearFilter"
      type="button"
      title="Clear height filter"
    >
      <span class="material-icons">close</span>
      Clear
    </button>
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
    },
    exponent: {
      type: Number,
      default: 1.0
    },
    double: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'update:modelValue' ],
  computed: {
    isFilterActive() {
      // Filter is active if current values differ from min/max range
      return this.modelValue.min !== this.min || this.modelValue.max !== this.max;
    }
  },
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
    if (!this.double) {
      if (this.modelValue.min !== this.min) {
        this.$emit('update:modelValue', {
          ...this.modelValue,
          min: this.min
        });
      }
    }
  },
  methods: {
    style(which) {
      const result = {
        left: this.valueToCss(this.modelValue[which])
      }
      return result;
    },
    betweenStyle() {
      return {
        left: this.valueToCss(this.modelValue.min),
        width: this.valueToPixels(this.modelValue.max) - this.valueToPixels(this.modelValue.min) + 'px'
      };
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
      return this.valueToPixels(value) + 'px';
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
      if (this.double) {
        if (which === 'min') {
          if (value >= this.modelValue.max) {
            value = this.modelValue.max - 1;
          }
        } else if (which === 'max') {
          if (value <= this.modelValue.min) {
            value = this.modelValue.min + 1;
          }
        }
      }
      return value;
    },
    acceptValue(which, e) {
      const offset = e.target.parentNode.getBoundingClientRect().x;
      const p = e.clientX - offset;
      let value = this.pixelsToValue(p);
      value = Math.max(value, this.min);
      value = Math.min(value, this.max);
      value = Math.round(value);
      value = this.preventCrossover(which, value);
      this.$emit('update:modelValue', {
        ...this.modelValue,
        [which]: value
      });
    },
    pixelsToValue(p) {
      const linearUnit = p / this.clientWidth;
      return Math.pow(linearUnit, this.exponent) * (this.max - this.min) + this.min;
    },
    valueToPixels(value) {
      const linearUnit = (value - this.min) / (this.max - this.min);
      return Math.pow(linearUnit, 1 / this.exponent) * this.clientWidth;
    },
    clearFilter() {
      // Reset to full range
      this.$emit('update:modelValue', {
        min: this.min,
        max: this.max
      });
    }
  }
};
</script>
<style scoped>
  .range {
    width: 100%;
    display: block;
    /* So we can drag the ranges */
    touch-action: none;
  }
  .range-controls {
    position: relative;
    height: 2em;
    margin: auto;
    margin-bottom: 32px;
    font-size: 17px;
    transform: translate(0, 24px);
    width: calc(100% - 2em);
  }
  .range-controls .end {
    position: absolute;
    width: 48px;
    height: 48px;
    border: 1px solid #eee;
    border-radius: 24px;
    background-color: #B74D15;
    transform: translate(-50%, -50%);
    box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);    
  }
  .range-controls .between {
    position: absolute;
    border-radius: 0.5em;
    border: 1px solid #aaa;
    background-color: #B74D15;
    transform: translate(0, -50%);
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
  .range-clear-button {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    padding: 6px 12px;
    background-color: #fcf9f4;
    color: #b74d15;
    border: 1px solid #b74d15;
    border-radius: 4px;
    font-size: 14px;
    font-family: Roboto;
    cursor: pointer;
    transition: background-color 0.2s, color 0.2s;
  }
  .range-clear-button:hover {
    background-color: #b74d15;
    color: #fcf9f4;
  }
  .range-clear-button .material-icons {
    font-size: 16px;
  }
</style>
