import { VERSION } from '../shared/config.js';
import { createEngine } from './core/engine.js';
if (globalThis.__jobFill?.engineVersion !== VERSION) globalThis.__jobFill = createEngine();
