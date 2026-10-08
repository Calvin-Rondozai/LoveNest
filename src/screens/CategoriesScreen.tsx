import { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryTile } from '../components/CategoryTile';
import { ProductCard } from '../components/ProductCard';
import { SearchBar } from '../components/SearchBar';
import { Icon } from '../components/Icon';
import { Category, Product } from '../data/catalog';
import { useCatalog } from '../store/catalog';
import { useTheme } from '../context/ThemeContext';
import { font, spacing, primary } from '../theme';
import { RootStackParamList, TabParamList } from '../navigation/types';

export const ALL_ID = 'all';
const allCategory: Category = { id: ALL_ID, name: 'All', icon: 'apps-outline', iconSet: 'ion' };

/** Every search word must appear in the product's name, description or category. */
const matches = (product: Product, query: string, categoryName: Record<string, string>) => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = `${product.name} ${product.description} ${categoryName[product.categoryId] ?? ''}`.toLowerCase();
  return words.every((w) => haystack.includes(w));
};

export const CategoriesScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const params = useRoute<RouteProp<TabParamList, 'Categories'>>().params;
  const [selected, setSelected] = useState(params?.categoryId ?? ALL_ID);
  const [query, setQuery] = useState(params?.query ?? '');
  const { categories, products, loading, error, load } = useCatalog();
  const tiles = useMemo(() => [allCategory, ...categories], [categories]);
  const categoryName = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name.toLowerCase()])), [categories]);

  // Home (search, Shop Now, category tiles) navigates here while the tab may already be mounted;
  // `ts` changes on every navigation so repeat searches still apply.
  useEffect(() => {
    if (!params) return;
    setSelected(params.categoryId ?? ALL_ID);
    setQuery(params.query ?? '');
  }, [params?.ts, params?.categoryId, params?.query]);

  const visible = products.filter((p) => (selected === ALL_ID || p.categoryId === selected) && matches(p, query, categoryName));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <Text style={[styles.title, { color: colors.text }]}>Categories</Text>
      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={setQuery} />
      </View>
      <FlatList
        horizontal
        data={tiles}
        keyExtractor={(c) => c.id}
        showsHorizontalScrollIndicator={false}
        style={styles.categoryStrip}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item }) => (
          <CategoryTile category={item} selected={selected === item.id} style={styles.categoryItem} onPress={() => setSelected(item.id)} />
        )}
      />
      {query.trim() ? (
        <Text style={[styles.resultCount, { color: colors.textMuted }]}>
          {visible.length} result{visible.length === 1 ? '' : 's'} for “{query.trim()}”
        </Text>
      ) : null}
      {error && !loading ? (
        <Text style={[styles.resultCount, { color: colors.textMuted }]}>Showing saved products. Pull down to try again.</Text>
      ) : null}
      <FlatList
        data={visible}
        keyExtractor={(p) => p.id}
        numColumns={2}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load({ force: true })} tintColor={primary} colors={[primary]} />}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={styles.grid}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ProductCard product={item} onPress={() => navigation.navigate('ProductDetail', { productId: item.id })} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="search-outline" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No gifts found</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Try a different word or category.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: font.size.xl, fontFamily: font.sansBold, paddingHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.md },
  searchWrap: { marginBottom: spacing.lg },
  categoryStrip: { flexGrow: 0 },
  categoryList: { paddingHorizontal: spacing.md, marginBottom: spacing.lg, gap: spacing.md },
  categoryItem: { width: 64 },
  resultCount: { fontSize: font.size.xs, fontFamily: font.sansMedium, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  grid: { paddingHorizontal: spacing.md, gap: spacing.md, paddingBottom: spacing.xl, flexGrow: 1 },
  empty: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.xs },
  emptyTitle: { fontSize: font.size.md, fontFamily: font.sansBold, marginTop: spacing.sm },
  emptyText: { fontSize: font.size.sm, fontFamily: font.sans },
});
