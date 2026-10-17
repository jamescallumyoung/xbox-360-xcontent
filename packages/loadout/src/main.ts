// Loadout's entry point: defines the app's elements, then opens the tab's session.
import './app/loadout-app.js';
import { startSession } from './app/start-session.js';
import { store } from './app/store-controller.js';

void startSession().then((session) => store.start(session));
