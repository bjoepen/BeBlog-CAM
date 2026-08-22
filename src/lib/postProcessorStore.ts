import { writable } from 'svelte/store';
import type { PostProcessorId } from './postprocessors';

export const postProcessorStore=writable<PostProcessorId>('grbl');
