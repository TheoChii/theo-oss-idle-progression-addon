/* One installed toolkit with two independent, cleanly-unmounted panels. */
import * as toolkit from '../progression-toolkit.addon.js';
import {SmartFarm} from './smartFarm.js';
const farm = new SmartFarm();
export function mount(...args) { toolkit.mount(...args); farm.mount(); }
export function unmount(...args) { farm.unmount(); toolkit.unmount(...args); }
