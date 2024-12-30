import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import Slider from '@react-native-community/slider';
import { Buffer } from 'buffer';
import { MaterialIcons } from '@expo/vector-icons';

const manager = new BleManager();

const BLE_CONFIG = {
  SERVICE_UUID: '000000ff-0000-1000-8000-00805f9b34fb',
  WRITE_CHARACTERISTIC: '0000ff03-0000-1000-8000-00805f9b34fb',
  READ_ANGLE_CHARACTERISTIC: '0000ff04-0000-1000-8000-00805f9b34fb',
};

const MOTOR_COMMANDS = {
  FORWARD: [0x01, 0x03],
  REVERSE: [0x01, 0x01],
  STOP: [0x01, 0x00],
  START_BREATHING: [0x01, 0x01, 0x01],
  STOP_BREATHING: [0x01, 0x00, 0x01],
};

export default function DeviceControl() {
  const [isScanning, setIsScanning] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [devices, setDevices] = useState([]);
  const [sliderValues, setSliderValues] = useState({ motor: 0, pump: 0 });
  const [breathingMode, setBreathingMode] = useState(false);

  useEffect(() => {
    const subscription = manager.onStateChange((state) => {
      if (state === 'PoweredOn') subscription.remove();
    }, true);

    return () => {
      subscription.remove();
      if (connectedDevice) connectedDevice.cancelConnection();
    };
  }, [connectedDevice]);

  // 权限请求
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const permissions = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(permissions).every(
        (status) => status === PermissionsAndroid.RESULTS.GRANTED
      );
    }
    return true;
  };

  // 开始扫描
  const startScan = async () => {
    const permissionGranted = await requestPermissions();
    if (!permissionGranted) {
      Alert.alert('Error', 'Bluetooth permissions are required to continue');
      return;
    }

    if (isScanning) return; // 防止重复扫描
    setIsScanning(true);
    setDevices([]);

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error(error);
        setIsScanning(false);
        return;
      }

      if (device.name === 'SYNC') {
        setDevices((prevDevices) => {
          if (!prevDevices.find((d) => d.id === device.id)) {
            return [...prevDevices, device];
          }
          return prevDevices;
        });
      }
    });

    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
    }, 5000);
  };

  // 连接设备
  const connectToDevice = async (device) => {
    try {
      console.log('Connecting to device:', device.name);
      const connectedDevice = await device.connect();
      await connectedDevice.discoverAllServicesAndCharacteristics();
      setConnectedDevice(connectedDevice);
      Alert.alert('Success', `Connected to device ${device.name}`);
    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert('Error', 'Failed to connect to device');
    }
  };

  // 断开连接
  const disconnectDevice = async () => {
    if (connectedDevice) {
      await connectedDevice.cancelConnection();
      setConnectedDevice(null);
      Alert.alert('Success', 'Device disconnected successfully');
    }
  };

  // 发送命令
  const sendCommand = async (command) => {
    if (!connectedDevice) {
      Alert.alert('Error', 'Please connect to a device first');
      return;
    }

    try {
      const base64Command = Buffer.from(command).toString('base64');
      await connectedDevice.writeCharacteristicWithResponseForService(
        BLE_CONFIG.SERVICE_UUID,
        BLE_CONFIG.WRITE_CHARACTERISTIC,
        base64Command
      );
      console.log('Command sent:', command);
    } catch (error) {
      console.error('Send command error:', error);
      Alert.alert('Error', 'Failed to send command');
    }
  };

  // 切换呼吸模式
  const toggleBreathingMode = async () => {
    try {
      if (breathingMode) {
        await sendCommand(MOTOR_COMMANDS.STOP_BREATHING);
      } else {
        await sendCommand(MOTOR_COMMANDS.START_BREATHING);
      }
      setBreathingMode(!breathingMode);
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle breathing mode');
    }
  };

  // UI 渲染
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Device Control</Text>
      </View>

      {/* Connection Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Connection</Text>
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.button, isScanning && styles.buttonDisabled]}
            onPress={startScan}
            disabled={isScanning}
          >
            <MaterialIcons name="bluetooth-searching" size={20} color="white" />
            <Text style={styles.buttonText}>
              {isScanning ? 'Scanning...' : 'Scan'}
            </Text>
          </Pressable>

          {connectedDevice && (
            <Pressable
              style={[styles.button, styles.buttonDanger]}
              onPress={disconnectDevice}
            >
              <MaterialIcons name="bluetooth-disabled" size={20} color="white" />
              <Text style={styles.buttonText}>Disconnect</Text>
            </Pressable>
          )}
        </View>

        {/* 设备列表 */}
        {devices.length > 0 && (
          <View style={styles.deviceList}>
            {devices.map((device) => (
              <Pressable
                key={device.id}
                style={styles.deviceItem}
                onPress={() => connectToDevice(device)}
                disabled={!!connectedDevice}
              >
                <MaterialIcons name="bluetooth" size={20} color="black" />
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <Text style={styles.deviceId}>ID: {device.id}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Motor Control */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Motor Controls</Text>
        <View style={styles.sliderContainer}>
          <Text>Motor Control ({sliderValues.motor})</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={255}
            value={sliderValues.motor}
            onSlidingComplete={(value) =>
              setSliderValues((prev) => ({ ...prev, motor: Math.round(value) }))
            }
            step={1}
          />
        </View>

        <Pressable
          style={[
            styles.controlButton,
            breathingMode && styles.activeButton,
          ]}
          onPress={toggleBreathingMode}
        >
          <MaterialIcons
            name={breathingMode ? 'pause' : 'play-arrow'}
            size={20}
            color="white"
          />
          <Text style={styles.buttonText}>
            {breathingMode ? 'Stop' : 'Start'} Breathing
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  card: { backgroundColor: 'white', borderRadius: 10, padding: 16, marginBottom: 16 },
  button: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#007bff', padding: 12, borderRadius: 8 },
  buttonDanger: { backgroundColor: '#dc3545' },
  buttonText: { color: 'white', marginLeft: 8 },
  deviceList: { marginTop: 16 },
  deviceItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#f0f0f0', borderRadius: 8, marginBottom: 8 },
  deviceName: { fontWeight: 'bold' },
});
