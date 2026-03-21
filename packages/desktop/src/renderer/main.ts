import { mount } from 'svelte';

import './app.css';
import 'uplot/dist/uPlot.min.css';
import App from './App.svelte';
import { setupMonacoEnvironment } from './lib/monacoEnvironment';

const target = document.getElementById('app');

if (!target) {
  throw new Error('Missing app mount target');
}

setupMonacoEnvironment();

mount(App, { target });
