import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import './floh.css';

mount(App, { target: document.getElementById('app')! });
