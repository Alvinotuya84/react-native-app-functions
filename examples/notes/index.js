/**
 * @format
 */

import { AppRegistry } from 'react-native';
// AppFunction handlers first: agent calls can start the app headless (no UI).
import './src/appFunctions';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
