module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2020: true
  },
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    parser: 'babel-eslint'
  },
  globals: {
    // Vue 3 script setup compiler macros
    defineProps: 'readonly',
    defineEmits: 'readonly',
    defineExpose: 'readonly',
    withDefaults: 'readonly'
  },
  // Exclude TypeScript files from ESLint - TypeScript compiler handles them
  ignorePatterns: ['*.ts', '*.tsx'],
  rules: {
    // Disable rules that conflict with TypeScript syntax in Vue files
    'no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true
    }],
    // Allow TypeScript type assertions (handled by TypeScript compiler)
    'no-undef': 'off' // TypeScript handles this
  },
  overrides: [
    {
      files: ['*.vue'],
      parser: 'vue-eslint-parser',
      parserOptions: {
        parser: 'babel-eslint',
        ecmaVersion: 2021,
        sourceType: 'module'
      },
      rules: {
        // In Vue files, be more lenient since TypeScript handles type checking
        'no-undef': 'off',
        // Disable parsing errors - TypeScript compiler handles syntax checking
        'no-unused-vars': 'off'
      }
    }
  ]
};

