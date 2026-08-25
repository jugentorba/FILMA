import React, { useMemo, useState } from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFilma } from '../store/FilmaContext';
import { FocusButton } from './FocusButton';
import { theme } from './theme';

export function ProfileSwitcher() {
  const { state, setActiveProfile, addProfile, removeProfile } = useFilma();
  const [visible, setVisible] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  const profiles = useMemo(
    () => state.profiles.filter(profile => !profile.deletedAt),
    [state.profiles],
  );
  const active = profiles.find(profile => profile.id === state.activeProfileId) ?? profiles[0];

  const copy = state.preferences.appLanguage === 'fr'
    ? {
        profiles: 'Profils',
        title: 'Changer de profil',
        help: 'Chaque profil garde séparément les favoris, la progression et Continuer à regarder.',
        current: 'Actuel',
        use: 'Utiliser',
        remove: 'Supprimer',
        add: 'Ajouter un profil',
        name: 'Nom du profil',
        close: 'Fermer',
      }
    : state.preferences.appLanguage === 'sq'
      ? {
          profiles: 'Profilet',
          title: 'Ndrysho profilin',
          help: 'Çdo profil mban veçmas të preferuarat, progresin dhe Vazhdo shikimin.',
          current: 'Aktual',
          use: 'Përdor',
          remove: 'Hiq',
          add: 'Shto profil',
          name: 'Emri i profilit',
          close: 'Mbyll',
        }
      : {
          profiles: 'Profiles',
          title: 'Switch profile',
          help: 'Each profile keeps Favorites, playback progress and Continue Watching separate.',
          current: 'Current',
          use: 'Use',
          remove: 'Remove',
          add: 'Add profile',
          name: 'Profile name',
          close: 'Close',
        };

  const addNow = () => {
    const name = newProfileName.trim();
    if (!name) return;
    addProfile(name);
    setNewProfileName('');
    setVisible(false);
  };

  return (
    <>
      <FocusButton
        compact
        label={active?.name ?? copy.profiles}
        accessibilityHint={copy.title}
        onPress={() => setVisible(true)}
      />

      <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={() => setVisible(false)}>
        <SafeAreaView style={styles.root}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>FILMA</Text>
              <Text style={styles.title}>{copy.title}</Text>
              <Text style={styles.help}>{copy.help}</Text>
            </View>
            <FocusButton compact label={copy.close} onPress={() => setVisible(false)} />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.profileList}>
              {profiles.map((profile, index) => {
                const isCurrent = profile.id === state.activeProfileId;
                const initials = profile.name.trim().slice(0, 2).toUpperCase() || 'F';
                return (
                  <View key={profile.id} style={[styles.profileRow, isCurrent && styles.profileRowCurrent]}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={styles.profileText}>
                      <Text numberOfLines={1} style={styles.profileName}>{profile.name}</Text>
                      <Text style={[styles.status, isCurrent && styles.statusCurrent]}>{isCurrent ? copy.current : copy.profiles}</Text>
                    </View>
                    <View style={styles.actions}>
                      <FocusButton
                        compact
                        label={isCurrent ? copy.current : copy.use}
                        active={isCurrent}
                        preferredFocus={Platform.isTV && (isCurrent || index === 0)}
                        onPress={() => {
                          setActiveProfile(profile.id);
                          setVisible(false);
                        }}
                      />
                      {profiles.length > 1 ? (
                        <FocusButton compact label={copy.remove} onPress={() => removeProfile(profile.id)} />
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.addCard}>
              <Text style={styles.addTitle}>{copy.add}</Text>
              <TextInput
                value={newProfileName}
                onChangeText={setNewProfileName}
                placeholder={copy.name}
                placeholderTextColor={theme.muted}
                autoCorrect={false}
                maxLength={30}
                style={styles.input}
                onSubmitEditing={addNow}
              />
              <View style={styles.addAction}>
                <FocusButton label={copy.add} active={Boolean(newProfileName.trim())} onPress={addNow} />
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  header: {
    minHeight: Platform.isTV ? 118 : 92,
    paddingHorizontal: Platform.isTV ? 54 : 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerText: { flex: 1 },
  eyebrow: { color: theme.accent, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  title: { color: theme.text, fontSize: Platform.isTV ? 30 : 23, fontWeight: '900', marginTop: 4 },
  help: { color: theme.muted, fontSize: Platform.isTV ? 14 : 12, lineHeight: Platform.isTV ? 20 : 18, marginTop: 4, maxWidth: 760 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Platform.isTV ? 54 : 18, paddingVertical: 20, paddingBottom: 70 },
  profileList: { gap: 10 },
  profileRow: {
    minHeight: Platform.isTV ? 82 : 68,
    padding: Platform.isTV ? 14 : 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    backgroundColor: theme.surface,
  },
  profileRowCurrent: { borderColor: theme.accent },
  avatar: {
    width: Platform.isTV ? 48 : 40,
    height: Platform.isTV ? 48 : 40,
    borderRadius: Platform.isTV ? 15 : 12,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: theme.text, fontWeight: '900', fontSize: Platform.isTV ? 17 : 14 },
  profileText: { flex: 1, minWidth: 0 },
  profileName: { color: theme.text, fontWeight: '900', fontSize: Platform.isTV ? 19 : 15 },
  status: { color: theme.muted, fontSize: 10, marginTop: 3 },
  statusCurrent: { color: theme.accent },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'flex-end' },
  addCard: {
    marginTop: 18,
    padding: Platform.isTV ? 18 : 14,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    backgroundColor: '#101521',
  },
  addTitle: { color: theme.text, fontWeight: '900', fontSize: Platform.isTV ? 18 : 15, marginBottom: 10 },
  input: {
    minHeight: Platform.isTV ? 50 : 44,
    borderWidth: 1,
    borderColor: '#31394d',
    borderRadius: 11,
    backgroundColor: theme.background,
    color: theme.text,
    paddingHorizontal: 12,
    fontSize: Platform.isTV ? 16 : 13,
  },
  addAction: { alignItems: 'flex-start', marginTop: 10 },
});
