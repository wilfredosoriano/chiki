/**
 * Chiki Chat — natural language financial commands with AI-like personality.
 */
import { useState, useRef, useCallback } from 'react';
import {
  View, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Image,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { executeCommand } from '@/utils/parseChikiCommand';
import type { ChikiResult } from '@/utils/parseChikiCommand';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  from: 'user' | 'chiki';
  text: string;
  mood?: ChikiResult['mood'];
  timestamp: Date;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Show my loans',
  'Show my goals',
  'How much did I spend this month?',
  'Transfer 2000 from BDO to GCash',
  'Balance of BDO',
  'Net worth',
  'How much did I earn this month?',
];

const MOOD_IMAGE: Record<string, ReturnType<typeof require>> = {
  happy:    require('../../assets/images/mood/happy.png'),
  sad:      require('../../assets/images/mood/sad.png'),
  warning:  require('../../assets/images/mood/shock.png'),
  thinking: require('../../assets/images/mood/thinking.png'),
  neutral:  require('../../assets/images/mood/neutral.png'),
};

function formatTime(d: Date) {
  return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ChikiChatScreen() {
  const { colors, spacing, radius, shadow, isDark, typography } = useTheme();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      from: 'chiki',
      text: "Hey! I'm Chiki!\n\nHere's what you can ask me:\n\n💳 Accounts\n• Transfer 2000 from BDO to GCash\n• Add 5000 to Maya\n• Remove 1500 from Cash\n• Balance of BDO / Net worth\n\n🏦 Loans\n• How much do I owe on SSS loan?\n• When is my BDO loan due?\n• Show my loans\n• Pay SSS loan from GCash\n\n🎯 Goals\n• How much have I saved for Emergency Fund?\n• Show my goals\n\n📊 Spending\n• How much did I spend this month?\n• How much did I earn this month?",
      mood: 'happy',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingStatus, setTypingStatus] = useState('typing...');
  const scrollRef = useRef<ScrollView>(null);
  const dotLoop = useRef<Animated.CompositeAnimation | null>(null);

  function stopDots() {
    dotLoop.current?.stop();
  }

  const appendMessage = useCallback((msg: Omit<Message, 'id'>) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    setMessages((prev) => [...prev, { ...msg, id }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  async function send(text?: string) {
    const raw = (text ?? input).trim();
    if (!raw || isTyping) return;
    setInput('');

    appendMessage({ from: 'user', text: raw, timestamp: new Date() });

    setIsTyping(true);
    setTypingStatus('reading your message...');
    await new Promise((r) => setTimeout(r, 350));
    setTypingStatus('thinking...');
    await new Promise((r) => setTimeout(r, 400));
    setTypingStatus('checking your accounts...');
    await new Promise((r) => setTimeout(r, 350));

    let result: ChikiResult;
    try {
      result = await executeCommand(raw);
    } catch (e: unknown) {
      result = {
        status: 'error',
        mood: 'sad',
        message: `Something went wrong: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    stopDots();
    setIsTyping(false);
    appendMessage({ from: 'chiki', text: result.message, mood: result.mood, timestamp: new Date() });
  }

  const showSuggestions = messages.length <= 1 && !isTyping;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ── */}
      <View style={[styles.header, {
        paddingTop: insets.top + spacing.sm,
        paddingHorizontal: spacing.lg,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
      }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>Chiki</Text>
            <Text style={{ color: colors.income, fontSize: 11, fontWeight: '500' }}>
              {isTyping ? typingStatus : 'Online'}
            </Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Messages ── */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xl,
          gap: 12,
        }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            colors={colors}
            radius={radius}
            shadow={shadow}
            isDark={isDark}
            typography={typography}
          />
        ))}

        {isTyping && (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <View style={[styles.avatarSmall, { backgroundColor: 'transparent' }]}>
              <Image source={MOOD_IMAGE.thinking} style={{ width: 140, height: 140 }} resizeMode="contain" />
            </View>
            <View style={[styles.chickyBubble, {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.xl,
              ...(isDark ? {} : shadow.sm),
              paddingHorizontal: 16,
              paddingVertical: 12,
            }]}>
              <TypingDots colors={colors} />
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Bottom area: suggestions + input ── */}
      <View style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
        paddingBottom: insets.bottom + 8,
      }}>
        {/* Suggestion chips — only on first load */}
        {showSuggestions && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingTop: 10,
              paddingBottom: 8,
              gap: 6,
              alignItems: 'center',
            }}
          >
            {SUGGESTIONS.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => send(s)}
                style={[styles.chip, {
                  backgroundColor: colors.surfaceSecondary ?? colors.background,
                  borderColor: colors.border,
                  borderRadius: radius.full,
                }]}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '500' }}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input row */}
        <View style={[styles.inputRow, {
          paddingHorizontal: spacing.lg,
          paddingTop: showSuggestions ? 0 : 10,
          paddingBottom: 4,
          gap: spacing.sm,
        }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Tell Chiki what to do..."
            placeholderTextColor={colors.textTertiary}
            style={[styles.textInput, {
              backgroundColor: colors.surfaceSecondary ?? colors.background,
              borderColor: colors.border,
              color: colors.textPrimary,
              borderRadius: radius.full,
              fontSize: 14,
            }]}
            onSubmitEditing={() => send()}
            returnKeyType="send"
            multiline={false}
            editable={!isTyping}
          />
          <TouchableOpacity
            onPress={() => send()}
            disabled={!input.trim() || isTyping}
            style={[styles.sendBtn, {
              backgroundColor: input.trim() && !isTyping ? colors.accent : colors.border,
              borderRadius: radius.full,
            }]}
          >
            {isTyping
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={16} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, colors, radius, shadow, isDark, typography }: {
  msg: Message;
  colors: any;
  radius: any;
  shadow: any;
  isDark: boolean;
  typography: any;
}) {
  const isUser = msg.from === 'user';

  if (isUser) {
    return (
      <View style={{ alignItems: 'flex-end' }}>
        <View style={[styles.userBubble, {
          backgroundColor: colors.accent,
          borderRadius: radius.xl,
          borderBottomRightRadius: 4,
        }]}>
          <Text style={{ color: '#fff', fontSize: 14, lineHeight: 20 }}>{msg.text}</Text>
        </View>
        <Text style={{ color: colors.textTertiary, fontSize: 10, marginTop: 4, marginRight: 4 }}>
          {formatTime(msg.timestamp)}
        </Text>
      </View>
    );
  }

  const moodImage = MOOD_IMAGE[msg.mood ?? 'neutral'] ?? MOOD_IMAGE.neutral;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
      <View style={[styles.avatarSmall, { backgroundColor: 'transparent' }]}>
        <Image source={moodImage} style={{ width: 140, height: 140 }} resizeMode="contain" />
      </View>
      <View style={{ flex: 1 }}>
        <View style={[styles.chickyBubble, {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.xl,
          borderBottomLeftRadius: 4,
          ...(isDark ? {} : shadow.sm),
        }]}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 21 }}>{msg.text}</Text>
        </View>
        <Text style={{ color: colors.textTertiary, fontSize: 10, marginTop: 4, marginLeft: 4 }}>
          {formatTime(msg.timestamp)}
        </Text>
      </View>
    </View>
  );
}

// ─── Typing dots ──────────────────────────────────────────────────────────────

function TypingDots({ colors }: { colors: any }) {
  const anims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  const start = useCallback(() => {
    const makeSeq = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: -5, duration: 250, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0,  duration: 250, useNativeDriver: true }),
          Animated.delay(400),
        ])
      );
    anims.forEach((a, i) => makeSeq(a, i * 150).start());
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useState(() => { start(); });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 20 }}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: colors.textTertiary,
            transform: [{ translateY: anim }],
          }}
        />
      ))}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmall: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  chickyBubble: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    maxWidth: '85%',
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 14,
  },
  sendBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
