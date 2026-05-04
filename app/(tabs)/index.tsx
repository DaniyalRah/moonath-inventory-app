import { CameraView, useCameraPermissions } from 'expo-camera';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useState } from 'react';
import {
  ActivityIndicator,
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../firebaseConfig';

let isProcessing = false;

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [barcodeType, setBarcodeType] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Form fields
  const [productName, setProductName] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need access to your camera to scan barcodes.</Text>
        <Button title="Grant Camera Permission" onPress={requestPermission} />
      </View>
    );
  }

  const handleBarcodeScan = async ({ type, data }: { type: string; data: string }) => {
    if (isProcessing) return;
    isProcessing = true;

    setScanned(true);
    setBarcode(data);
    setBarcodeType(type);
    setMessage('');

    // Check for duplicate first
    try {
      const q = query(collection(db, 'products'), where('barcode', '==', data));
      const existing = await getDocs(q);
      if (!existing.empty) {
        setMessage('⚠️ Product already exists in inventory!');
        return;
      }
      // Not a duplicate — show the form
      setShowForm(true);
    } catch (error) {
      setMessage('❌ Error checking inventory. Please try again.');
    }
  };

  const handleSave = async () => {
    if (!productName.trim()) {
      setMessage('❌ Please enter a product name.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      await addDoc(collection(db, 'products'), {
        barcode: barcode,
        barcodeType: barcodeType,
        name: productName.trim(),
        buyPrice: buyPrice ? parseFloat(buyPrice) : null,
        sellPrice: sellPrice ? parseFloat(sellPrice) : null,
        status: 'Received',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setShowForm(false);
      setMessage('✅ Product saved to inventory!');
    } catch (error) {
      setMessage('❌ Error saving product. Please try again.');
    }

    setSaving(false);
  };

  const resetScanner = () => {
    isProcessing = false;
    setScanned(false);
    setShowForm(false);
    setMessage('');
    setProductName('');
    setBuyPrice('');
    setSellPrice('');
  };

  return (
    <View style={styles.container}>

      {/* Camera viewfinder — hide when form is showing */}
      {!showForm && (
        <CameraView
          style={styles.camera}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScan}
        />
      )}

      {/* Aim guide overlay */}
      {!scanned && !showForm && (
        <View style={styles.overlay}>
          <View style={styles.aimBox} />
          <Text style={styles.hint}>Point at a barcode</Text>
        </View>
      )}

      {/* Duplicate / error message (no form needed) */}
      {scanned && !showForm && (
        <View style={styles.result}>
          <Text style={styles.label}>Scanned Code:</Text>
          <Text style={styles.value}>{barcode}</Text>
          <Text style={styles.statusMessage}>{message}</Text>
          <TouchableOpacity style={styles.button} onPress={resetScanner}>
            <Text style={styles.buttonText}>Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Product details form */}
      {showForm && (
        <KeyboardAvoidingView
          style={styles.formContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.form}>

            <Text style={styles.formTitle}>New Product</Text>
            <Text style={styles.formBarcode}>{barcode}</Text>

            {/* Product Name */}
            <Text style={styles.inputLabel}>Product Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sony WH-1000XM5"
              placeholderTextColor="#555"
              value={productName}
              onChangeText={setProductName}
            />

            {/* Buy Price */}
            <Text style={styles.inputLabel}>Buy Price ($)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 25.00"
              placeholderTextColor="#555"
              value={buyPrice}
              onChangeText={setBuyPrice}
              keyboardType="decimal-pad"
            />

            {/* Sell Price */}
            <Text style={styles.inputLabel}>Sell Price ($) — optional</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 45.00"
              placeholderTextColor="#555"
              value={sellPrice}
              onChangeText={setSellPrice}
              keyboardType="decimal-pad"
            />

            {message ? <Text style={styles.errorMessage}>{message}</Text> : null}

            {/* Save button */}
            {saving ? (
              <ActivityIndicator size="large" color="#00ff88" style={{ marginTop: 20 }} />
            ) : (
              <>
                <TouchableOpacity style={styles.button} onPress={handleSave}>
                  <Text style={styles.buttonText}>Save Product</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={resetScanner}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  message: { textAlign: 'center', padding: 20, fontSize: 16, color: '#fff' },
  camera: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aimBox: {
    width: 250,
    height: 150,
    borderWidth: 2,
    borderColor: '#00ff88',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  hint: {
    color: '#fff',
    marginTop: 16,
    fontSize: 14,
    opacity: 0.8,
  },
  result: {
    flex: 1,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
  },
  label: { fontSize: 13, color: '#888', marginBottom: 6 },
  value: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  statusMessage: {
    fontSize: 15,
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  formContainer: { flex: 1 },
  form: {
    padding: 28,
    paddingTop: 60,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  formBarcode: {
    fontSize: 13,
    color: '#555',
    marginBottom: 28,
  },
  inputLabel: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  errorMessage: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { fontWeight: 'bold', color: '#000', fontSize: 16 },
  cancelButton: { alignItems: 'center', padding: 16 },
  cancelText: { color: '#888', fontSize: 15 },
});