import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { initInstall } from './lib/install.svelte';
import { trackViewport } from './lib/viewport';

// Publishes the visible area as CSS variables before anything lays out against
// them, and keeps them current as browser chrome comes and goes.
trackViewport();
initInstall();

const target = document.getElementById('app');
if (!target) throw new Error('#app missing from the document');

export default mount(App, { target });
