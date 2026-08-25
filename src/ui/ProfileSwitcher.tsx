import React, { useMemo, useState } from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFilma } from '../store/FilmaContext';
import { FocusButton } from './FocusButton';
import { theme } from './theme';
import { useResponsiveLayout } from './useResponsiveLayout';

export function ProfileSwitcher() {
  const { state, setActiveProfile, addProfile, removeProfile } = useFilma();
  const layout = useResponsiveLayout();
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

  const headerStyle = useMemo(() => ({
    minHeight: layout.isTv ? 100 : layout.isCompactPhone ? 68 : layout.isTablet ? 88 : 78,
    paddingHorizontal: layout.horizontalPadding,
    paddingVertical: layout.isTv ? 14 : layout.isCompactPhone ? 9 : 12,
    gap: layout.isCompactPhone ? 10 : 18,
  }), [layout.horizontalPadding, layout.isCompactPhone, layout.isTablet, layout.isTv]);

  const titleStyle = useMemo(() => ({
    fontSize: layout.isTv ? 27 : layout.isCompactPhone ? 19 : layout.isTablet ? 24 : 21,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);

  const helpStyle = useMemo(() => ({
    fontSize: layout.isTv ? 13 : layout.isCompactPhone ? 10 : 12,
    lineHeight: layout.isTv ? 19 : layout.isCompactPhone ? 15 : 18,
  }), [layout.isCompactPhone, layout.isTv]);

  const contentStyle = useMemo(() => ({
    paddingHorizontal: layout.horizontalPadding,
    paddingVertical: layout.isCompactPhone ? 12 : 18,
    paddingBottom: layout.isTv ? 64 : 90,
  }), [layout.horizontalPadding, layout.isCompactPhone, layout.isTv]);

  const rowStyle = useMemo(() => ({
    minHeight: layout.isTv ? 72 : layout.isCompactPhone ? 54 : layout.isTablet ? 66 : 60,
    padding: layout.isTv ? 11 : layout.isCompactPhone ? 7 : 9,
    gap: layout.isCompactPhone ? 8 : 11,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);

  const avatarStyle = useMemo(() => {
    const size = layout.isTv ? 44 : layout.isCompactPhone ? 32 : layout.isTablet ? 40 : 36;
    return { width: size, height: size, borderRadius: Math.round(size * 0.3) };
  }, [layout.isCompactPhone, layout.isTablet, layout.isTv]);

  const profileNameStyle = useMemo(() => ({
    fontSize: layout.isTv ? 17 : layout.isCompactPhone ? 12 : layout.isTablet ? 15 : 14,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);

  const inputStyle = useMemo(() => ({
    minHeight: layout.isTv ? 46 : layout.isCompactPhone ? 38 : 42,
    fontSize: layout.isTv ? 15 : layout.isCompactPhone ? 12 : 13,
  }), [layout.isCompactPhone, layout.isTv]);

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
          <View style={[styles.header, headerStyle]}>
            <View style={styles.headerText}>
              <Text style={[styles.eyebrow, layout.isCompactPhone && styles.eyebrowCompact]}>FILMA</Text>
              <Text style={[styles.title, titleStyle]}>{copy.title}</Text>
              <Text numberOfLines={layout.isCompactPhone ? 1 : 2} style={[styles.help, helpStyle]}>{copy.help}</Text>
            </View>
            <FocusButton compact label={copy.close} onPress={() => setVisible(false)} />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled">
            <View style={[styles.profileList, layout.isCompactPhone && styles.profileListCompact]}>
              {profiles.map((profile, index) => {
                const isCurrent = profile.id === state.activeProfileId;
                const initials = profile.name.trim().slice(0, 2).toUpperCase() || 'F';
                return (
                  <View key={profile.id} style={[styles.profileRow, rowStyle, isCurrent && styles.profileRowCurrent]}>
                    <View style={[styles.avatar, avatarStyle]}>
                      <Text style={[styles.avatarText, { fontSize: layout.isTv ? 16 : layout.isCompactPhone ? 11 : 13 }]}>{initials}</Text>
                    </View>
                    <View style={styles.profileText}>
                      <Text numberOfLines={1} style={[styles.profileName, profileNameStyle]}>{profile.name}</Text>
                      <Text style={[styles.status, layout.isCompactPhone && styles.statusCompact, isCurrent && styles.statusCurrent]}>{isCurrent ? copy.current : copy.profiles}</Text>
                    </View>
                    <View style={[styles.actions, layout.isCompactPhone && styles.actionsCompact]}>
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

            <View style={[styles.addCard, { padding: layout.isTv ? 16 : layout.isCompactPhone ? 10 : 13 }]}>
              <Text style={[styles.addTitle, { fontSize: layout.isTv ? 17 : layout.isCompactPhone ? 13 : 15 }]}>{copy.add}</Text>
              <TextInput
                value={newProfileName}
                onChangeText={setNewProfileName}
                placeholder={copy.name}
                placeholderTextColor={theme.muted}
                autoCorrect={false}
                maxLength={30}
                style={[styles.input, inputStyle]}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: { color: theme.accent, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  eyebrowCompact: { fontSize: 9, letterSpacing: 1.4 },
  title: { color: theme.text, fontWeight: '900', marginTop: 3 },
  help: { color: theme.muted, marginTop: 3, maxWidth: 760 },
  scroll: { flex: 1 },
  content: {},
  profileList: { gap: 9 },
  profileListCompact: { gap: 6 },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 13,
    backgroundColor: theme.surface,
  },
  profileRowCurrent: { borderColor: theme.accent },
  avatar: {
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { color: theme.text, fontWeight: '900' },
  profileText: { flex: 1, minWidth: 0 },
  profileName: { color: theme.text, fontWeight: '900' },
  status: { color: theme.muted, fontSize: 10, marginTop: 3 },
  statusCompact: { fontSize: 9, marginTop: 1 },
  statusCurrent: { color: theme.accent },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'flex-end' },
  actionsCompact: { gap: 4 },
  addCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 13,
    backgroundColor: '#101521',
  },
  addTitle: { color: theme.text, fontWeight: '900', marginBottom: 9 },
  input: {
    borderWidth: 1,
    borderColor: '#31394d',
    borderRadius: 10,
    backgroundColor: theme.background,
    color: theme.text,
    paddingHorizontal: 11,
  },
  addAction: { alignItems: 'flex-start', marginTop: 9 },
});