<template>
  <div class="range" ref="el">
    <div class="labels">
      <span v-for="(choice, i) in choices" :key="choice" :style="labelStyle(i)">
        {{ choice }}
      </span>
    </div>
    <div class="controls">
      <span class="end min" :style="style('min')" tabindex="0" @keyup.left="nudge('min', -1)" @keyup.right="nudge('min', 1)" @pointerdown="down('min', $event)" @pointermove="move('min', $event)" @pointerup="up('min', $event)"></span>
      <!-- <span class="between"></span> -->
      <span class="end max" :style="style('max')" tabindex="0" @keyup.left="nudge('max', -1)" @keyup.right="nudge('max', 1)" @pointerdown="down('max', $event)" @pointermove="move('max', $event)" @pointerup="up('max', $event)"></span>
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
    console.log('setting clientWidth');
    this.clientWidth = this.$el.clientWidth;
    this.observer = new ResizeObserver(() => {
      this.clientWidth = this.$el.clientWidth;
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
    valueToCss(value) {
      const px = (value - this.min) / (this.max - this.min) * this.clientWidth;
      return `calc(${px}px - 0.5em)`;
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
      console.log('capturing');
    },
    move(which, e) {
      if (!e.isPrimary) {
        return;
      }
      if (!this.isDown) {
        return;
      }
      console.log('moved');
      this.acceptValue(which, e);
    },
    up(which, e) {
      if (!e.isPrimary) {
        return;
      }
      this.isDown = false;
      console.log('up');
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
      console.log(which, value);
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
<style>
  .range {
    position: relative;
    width: 100%;
    display: block;
  }
  .controls {
    height: 1em;
  }
  .end {
    position: absolute;
    width: 1em;
    border: 1px solid #eee;
    border-radius: 0.5em;
    background-color: blue;
  }
  .between {
    position: absolute;
  }
  .labels {
    position: relative;
    height: 1em;
    padding-bottom: 1em;
  }
  .labels span {
    position: absolute;
    display: block;
  }
</style>
