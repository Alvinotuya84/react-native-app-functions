import { AppRegistry } from 'react-native';
// AppFunction JS handlers must register at the top level: agent calls can start the app
// headless, without mounting any component.
import './src/appFunctions';
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
