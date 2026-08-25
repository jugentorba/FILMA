import React from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FocusButton } from './FocusButton';
import { theme } from './theme';

export type StreamChoice = {
  title: string;
  url: string;
};

type Props = {
  title: string;
  streams: StreamChoice[];
  onChoose(stream: StreamChoice): void;
  onClose(): void;
};

export function StreamPickerModal({ title, streams, onChoose, onClose }: Props) {
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>CHOOSE STREAM</Text>
          <Text style={styles.title}>{title}</Text>
          <ScrollView contentContainerStyle={styles.list}>
            {streams.map((stream, index) => (
              <FocusButton
                key={`${stream.url}:${index}`}
                label={stream.title}
                onPress={() => onChoose(stream)}
                style={styles.stream}
              />
            ))}
          </ScrollView>
          <FocusButton compact label="Cancel" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: Platform.isTV ? 850 : 560,
    maxHeight: '80%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: Platform.isTV ? 28 : 20,
  },
  eyebrow: {
    color: theme.accent,
    fontWeight: '900',
    letterSpacing: 1.5,
    fontSize: 12,
  },
  title: {
    color: theme.text,
    fontSize: Platform.isTV ? 31 : 24,
    fontWeight: '900',
    marginTop: 7,
    marginBottom: 18,
  },
  list: {
    gap: 10,
    paddingBottom: 18,
  },
  stream: {
    width: '100%',
    alignItems: 'flex-start',
  },
});
