import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { HomeScreen } from '../screens/HomeScreen';
import { CategoriesScreen } from '../screens/CategoriesScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { useCart } from '../store/cart';
import { useTheme } from '../context/ThemeContext';
import { primary } from '../theme';
import { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

const CartIcon = ({ color, size }: { color: string; size: number }) => {
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  return (
    <View>
      <Icon name="cart-outline" color={color} size={size} />
      {count > 0 && <View style={styles.dot} />}
    </View>
  );
};

const styles = StyleSheet.create({
  dot: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: primary },
});

const NoopScreen = () => null;

export const TabNavigator = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // A fixed height ignores the system nav bar, so add the inset plus extra breathing room.
  const bottomPad = insets.bottom + 14;
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 58 + bottomPad, paddingTop: 6, paddingBottom: bottomPad },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ color, size }) => <Icon name="home-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Categories" component={CategoriesScreen} options={{ tabBarIcon: ({ color, size }) => <Icon name="grid-outline" color={color} size={size} /> }} />
      <Tab.Screen
        name="CartTab"
        component={NoopScreen}
        options={{ title: 'Cart', tabBarIcon: CartIcon }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.getParent()?.navigate('Cart');
          },
        })}
      />
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ tabBarIcon: ({ color, size }) => <Icon name="receipt-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ color, size }) => <Icon name="person-outline" color={color} size={size} /> }} />
    </Tab.Navigator>
  );
};
