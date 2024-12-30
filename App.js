import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import LinkedDevices from './src/LinkedDevices'; // 导入您的LinkedDevices组件

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <LinkedDevices />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
