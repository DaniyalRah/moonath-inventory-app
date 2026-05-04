import { collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../firebaseConfig';

const STATUSES = ['All', 'Received', 'Tested', 'Sold', 'Returned'];

const STATUS_COLORS: Record<string, string> = {
  Received: '#3b82f6',
  Tested:   '#f59e0b',
  Sold:     '#10b981',
  Returned: '#ef4444',
};

type Product = {
  id: string;
  barcode: string;
  barcodeType: string;
  name: string;
  buyPrice: number | null;
  sellPrice: number | null;
  notes: string | null;
  status: string;
  createdAt: any;
  updatedAt: any;
};

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [updating, setUpdating] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  // Edit fields
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editBuyPrice, setEditBuyPrice] = useState('');
  const [editSellPrice, setEditSellPrice] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as Product[];
      setProducts(items);
      applyFilters(items, search, activeFilter);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const applyFilters = (items: Product[], searchText: string, statusFilter: string) => {
    let result = items;
    if (statusFilter !== 'All') {
      result = result.filter(p => p.status === statusFilter);
    }
    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(lower) ||
        p.barcode?.includes(lower)
      );
    }
    setFiltered(result);
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    applyFilters(products, text, activeFilter);
  };

  const handleFilter = (status: string) => {
    setActiveFilter(status);
    applyFilters(products, search, status);
  };

  const openProduct = (item: Product) => {
    setSelected(item);
    setEditStatus(item.status);
    setEditNotes(item.notes || '');
    setEditBuyPrice(item.buyPrice != null ? String(item.buyPrice) : '');
    setEditSellPrice(item.sellPrice != null ? String(item.sellPrice) : '');
  };

  const handleSave = async () => {
    if (!selected) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'products', selected.id), {
        status: editStatus,
        notes: editNotes.trim() || null,
        buyPrice: editBuyPrice ? parseFloat(editBuyPrice) : null,
        sellPrice: editSellPrice ? parseFloat(editSellPrice) : null,
        updatedAt: new Date(),
      });
      await fetchProducts();
      setSelected(null);
    } catch (error) {
      console.error('Error updating product:', error);
    }
    setUpdating(false);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() ?? new Date(timestamp);
    return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const calcProfit = (buy: number | null, sell: number | null) => {
    if (buy == null || sell == null) return null;
    return sell - buy;
  };

  const totalProfit = products.reduce((sum, p) => {
    const profit = calcProfit(p.buyPrice, p.sellPrice);
    return profit != null ? sum + profit : sum;
  }, 0);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00ff88" />
        <Text style={styles.loadingText}>Loading inventory...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.header}>Inventory ({products.length})</Text>
        <View style={styles.profitBadge}>
          <Text style={styles.profitLabel}>Total Profit</Text>
          <Text style={[styles.profitValue, { color: totalProfit >= 0 ? '#00ff88' : '#ef4444' }]}>
            ${totalProfit.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Search bar */}
      <TextInput
        style={styles.searchBar}
        placeholder="Search by name or barcode..."
        placeholderTextColor="#555"
        value={search}
        onChangeText={handleSearch}
      />

      {/* Status filter buttons */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {STATUSES.map(status => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              activeFilter === status && styles.filterButtonActive,
              activeFilter === status && status !== 'All' && { backgroundColor: STATUS_COLORS[status] },
            ]}
            onPress={() => handleFilter(status)}>
            <Text style={[
              styles.filterButtonText,
              activeFilter === status && styles.filterButtonTextActive,
            ]}>
              {status}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Refresh button */}
      <TouchableOpacity style={styles.refreshButton} onPress={fetchProducts}>
        <Text style={styles.refreshText}>↻ Refresh</Text>
      </TouchableOpacity>

      {/* Product list */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const profit = calcProfit(item.buyPrice, item.sellPrice);
          return (
            <TouchableOpacity style={styles.card} onPress={() => openProduct(item)}>
              <View style={styles.cardTop}>
                <Text style={styles.productName} numberOfLines={1}>
                  {item.name || 'Unnamed Product'}
                </Text>
                <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] || '#888' }]}>
                  <Text style={styles.badgeText}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.barcodeText}>
                {item.barcode} · {item.barcodeType?.toUpperCase()}
              </Text>
              {item.notes ? (
                <Text style={styles.notesText} numberOfLines={1}>📝 {item.notes}</Text>
              ) : null}
              <View style={styles.cardBottom}>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Bought</Text>
                  <Text style={styles.priceValue}>
                    {item.buyPrice != null ? `$${item.buyPrice.toFixed(2)}` : '—'}
                  </Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Sold for</Text>
                  <Text style={styles.priceValue}>
                    {item.sellPrice != null ? `$${item.sellPrice.toFixed(2)}` : '—'}
                  </Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Profit</Text>
                  <Text style={[
                    styles.priceValue,
                    { color: profit == null ? '#555' : profit >= 0 ? '#00ff88' : '#ef4444' }
                  ]}>
                    {profit == null ? '—' : `$${profit.toFixed(2)}`}
                  </Text>
                </View>
                <Text style={styles.timestamp}>Added {formatDate(item.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {search || activeFilter !== 'All' ? 'No products match your filters.' : 'No products yet. Scan something!'}
          </Text>
        }
      />

      {/* Edit modal */}
      <Modal visible={!!selected} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <ScrollView>
                <Text style={styles.modalTitle}>{selected?.name || 'Unnamed Product'}</Text>
                <Text style={styles.modalBarcode}>{selected?.barcode}</Text>

                <Text style={styles.inputLabel}>Status</Text>
                <View style={styles.statusButtons}>
                  {STATUSES.filter(s => s !== 'All').map(status => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusChip,
                        editStatus === status && { backgroundColor: STATUS_COLORS[status] }
                      ]}
                      onPress={() => setEditStatus(status)}>
                      <Text style={[
                        styles.statusChipText,
                        editStatus === status && { color: '#fff' }
                      ]}>
                        {status}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Buy Price ($)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 25.00"
                  placeholderTextColor="#555"
                  value={editBuyPrice}
                  onChangeText={setEditBuyPrice}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.inputLabel}>Sell Price ($)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 45.00"
                  placeholderTextColor="#555"
                  value={editSellPrice}
                  onChangeText={setEditSellPrice}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  placeholder="e.g. Minor scratch on back, includes charger..."
                  placeholderTextColor="#555"
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                />

                {updating ? (
                  <ActivityIndicator size="large" color="#00ff88" style={{ marginTop: 20 }} />
                ) : (
                  <>
                    <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelButton} onPress={() => setSelected(null)}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', paddingTop: 60, paddingHorizontal: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  loadingText: { color: '#fff', marginTop: 12, fontSize: 15 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  profitBadge: { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 10, alignItems: 'flex-end', borderWidth: 1, borderColor: '#2a2a2a' },
  profitLabel: { color: '#888', fontSize: 11 },
  profitValue: { fontSize: 18, fontWeight: 'bold' },
  searchBar: { backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#333', marginBottom: 10 },
  filterRow: { marginBottom: 8 },
  filterButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1a1a1a', marginRight: 8, borderWidth: 1, borderColor: '#333' },
  filterButtonActive: { borderColor: 'transparent' },
  filterButtonText: { color: '#888', fontSize: 13 },
  filterButtonTextActive: { color: '#fff', fontWeight: 'bold' },
  refreshButton: { alignSelf: 'flex-end', marginBottom: 12 },
  refreshText: { color: '#00ff88', fontSize: 15 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  productName: { color: '#fff', fontSize: 16, fontWeight: 'bold', flex: 1, marginRight: 10 },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  barcodeText: { color: '#555', fontSize: 12, marginBottom: 4 },
  notesText: { color: '#888', fontSize: 12, marginBottom: 8, fontStyle: 'italic' },
  cardBottom: { borderTopWidth: 1, borderTopColor: '#2a2a2a', paddingTop: 10, marginTop: 8 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  priceLabel: { color: '#888', fontSize: 13 },
  priceValue: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  timestamp: { color: '#444', fontSize: 11, marginTop: 8 },
  empty: { color: '#888', textAlign: 'center', marginTop: 40, fontSize: 15 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modal: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  modalBarcode: { color: '#555', fontSize: 13, marginBottom: 20 },
  inputLabel: { color: '#888', fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: '#111', color: '#fff', borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#333', marginBottom: 16 },
  notesInput: { height: 80, textAlignVertical: 'top' },
  statusButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statusChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#222', borderWidth: 1, borderColor: '#333' },
  statusChipText: { color: '#888', fontSize: 13 },
  saveButton: { backgroundColor: '#00ff88', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  saveButtonText: { fontWeight: 'bold', color: '#000', fontSize: 16 },
  cancelButton: { alignItems: 'center', padding: 16 },
  cancelText: { color: '#888', fontSize: 15 },
});