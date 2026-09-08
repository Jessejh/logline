import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { initInstall } from './lib/install.svelte';

initInstall();

const target = document.getElementById('app');
if (!target) throw new Error('#app missing from the document');

export default mount(App, { target });
