import { Text, View, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>react-native-app-functions example</Text>
      <Text>listTodaysRecords: native handler (Kotlin)</Text>
      <Text>findRecord: JS handler (src/appFunctions.ts)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontWeight: 'bold',
  },
});
