import { useRef, useState } from 'react';
import { View, Text, Image, Pressable, Animated, FlatList, StyleSheet, useWindowDimensions, ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { useOnboarding } from '../store/onboarding';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing, primary, onPrimary } from '../theme';

type Slide = { key: string; icon?: string; title: string; script: string; body: string };

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    title: 'Gifts for',
    script: 'Every Moment',
    body: 'Discover thoughtful gifts for birthdays, anniversaries and every special moment in between.',
  },
  {
    key: 'personal',
    icon: 'gift-outline',
    title: 'Made Personal,',
    script: 'Sent with Love',
    body: 'Pick the perfect gift, add a heartfelt message, and we will wrap it with care.',
  },
  {
    key: 'delivery',
    icon: 'car-outline',
    title: 'Fast & Safe',
    script: 'Delivery',
    body: 'Pay with mobile money or cash on delivery, and track every order right to their door.',
  },
];

export const OnboardingScreen = () => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const complete = useOnboarding((s) => s.complete);
  const listRef = useRef<FlatList<Slide>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  const next = () => (isLast ? complete() : listRef.current?.scrollToIndex({ index: index + 1, animated: true }));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={styles.topBar}>
        <Text style={[styles.brand, { color: colors.text }]}>
          Love<Text style={{ color: primary }}>Nest</Text>
        </Text>
        {!isLast ? (
          <Pressable onPress={complete} hitSlop={12}>
            <Text style={[styles.skip, { color: colors.textMuted }]}>Skip</Text>
          </Pressable>
        ) : null}
      </View>

      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.artOuter, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <View style={[styles.artInner, { backgroundColor: colors.surface }]}>
                {item.icon ? (
                  <View style={styles.iconDisc}>
                    <Icon name={item.icon} size={56} color={onPrimary} />
                  </View>
                ) : (
                  <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
                )}
              </View>
              <View style={[styles.floatHeart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Icon name="heart" size={18} color={primary} />
              </View>
            </View>

            <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
            <Text style={styles.script}>{item.script}</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 24, 8], extrapolate: 'clamp' });
            const opacity = scrollX.interpolate({ inputRange, outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' });
            return <Animated.View key={s.key} style={[styles.dot, { width: dotWidth, opacity }]} />;
          })}
        </View>
        <Button label={isLast ? 'Get Started' : 'Next'} onPress={next} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    minHeight: 40,
  },
  brand: { fontSize: font.size.lg, fontFamily: font.sansBold },
  skip: { fontSize: font.size.sm, fontFamily: font.sansSemi },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  artOuter: {
    width: 240,
    height: 240,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  artInner: { width: 176, height: 176, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  iconDisc: { width: 112, height: 112, borderRadius: radii.pill, backgroundColor: primary, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 120, height: 120 },
  floatHeart: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: font.size.xl, fontFamily: font.sansBold, textAlign: 'center' },
  script: { fontFamily: font.script, color: primary, fontSize: font.size.xxl, textAlign: 'center', marginTop: -4, marginBottom: spacing.md },
  body: { fontSize: font.size.sm, fontFamily: font.sans, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  dot: { height: 8, borderRadius: radii.pill, backgroundColor: primary },
});
