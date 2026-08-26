import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFilma } from '../store/FilmaContext';
import { FocusButton } from './FocusButton';
import { useResponsiveLayout } from './useResponsiveLayout';

const AVATAR_BACKGROUNDS = ['#17364a', '#43551f', '#51312f', '#312e53', '#5a3b19', '#244638'];

export function ProfileSwitcher() {
  const { state, setActiveProfile, addProfile, removeProfile } = useFilma();
  const layout = useResponsiveLayout();
  const [visible, setVisible] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [adding, setAdding] = useState(false);
  const [manageMode, setManageMode] = useState(false);

  const profiles = useMemo(() => state.profiles.filter(profile => !profile.deletedAt), [state.profiles]);
  const active = profiles.find(profile => profile.id === state.activeProfileId) ?? profiles[0];

  const copy = state.preferences.appLanguage === 'fr'
    ? { profiles: 'Profils', who: 'Qui regarde ?', add: 'Ajouter un profil', manage: 'Gérer les profils', done: 'Terminé', name: 'Nom du profil', create: 'Créer', cancel: 'Annuler', current: 'Profil actuel' }
    : state.preferences.appLanguage === 'sq'
      ? { profiles: 'Profilet', who: 'Kush po shikon?', add: 'Shto profil', manage: 'Menaxho profilet', done: 'Mbarova', name: 'Emri i profilit', create: 'Krijo', cancel: 'Anulo', current: 'Profili aktual' }
      : { profiles: 'Profiles', who: "Who's watching?", add: 'Add a profile', manage: 'Manage profiles', done: 'Done', name: 'Profile name', create: 'Create', cancel: 'Cancel', current: 'Current profile' };

  const addNow = () => {
    const name = newProfileName.trim();
    if (!name) return;
    addProfile(name);
    setNewProfileName('');
    setAdding(false);
  };

  const avatarSize = layout.isTv ? 180 : layout.isTablet ? 150 : layout.isCompactPhone ? 116 : 128;
  const columns = layout.isTv ? 4 : 2;

  return (
    <>
      <FocusButton compact label={active?.name ?? copy.profiles} accessibilityHint={copy.who} onPress={() => setVisible(true)} />

      <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={() => setVisible(false)}>
        <SafeAreaView style={styles.root}>
          <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: layout.isTv ? 80 : 26, paddingBottom: 70 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[styles.title, { fontSize: layout.isTv ? 48 : layout.isTablet ? 42 : 34, marginTop: layout.isTv ? 56 : 54 }]}>{copy.who}</Text>

            <View style={[styles.grid, { maxWidth: layout.isTv ? 1000 : 560 }]}>
              {profiles.map((profile, index) => {
                const initials = profile.name.trim().slice(0, 2).toUpperCase() || 'F';
                const isCurrent = profile.id === state.activeProfileId;
                return (
                  <Pressable
                    key={profile.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${profile.name}${isCurrent ? `, ${copy.current}` : ''}`}
                    onPress={() => {
                      if (manageMode) {
                        if (profiles.length > 1) removeProfile(profile.id);
                        return;
                      }
                      setActiveProfile(profile.id);
                      setVisible(false);
                    }}
                    style={({ pressed }) => [styles.profileCell, { width: columns === 2 ? '46%' : '22%' }, pressed && styles.pressed]}
                  >
                    <View style={[styles.avatarRing, isCurrent && styles.avatarRingCurrent, { width: avatarSize + 12, height: avatarSize + 12, borderRadius: avatarSize }]}>
                      <View style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, backgroundColor: AVATAR_BACKGROUNDS[index % AVATAR_BACKGROUNDS.length] }]}>
                        <Text style={[styles.avatarText, { fontSize: Math.round(avatarSize * 0.28) }]}>{initials}</Text>
                      </View>
                      {manageMode && profiles.length > 1 ? <View style={styles.removeBadge}><Text style={styles.removeBadgeText}>×</Text></View> : null}
                    </View>
                    <Text numberOfLines={1} style={[styles.profileName, { fontSize: layout.isTv ? 24 : 18 }]}>{profile.name}</Text>
                  </Pressable>
                );
              })}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.add}
                onPress={() => { setAdding(true); setManageMode(false); }}
                style={({ pressed }) => [styles.profileCell, { width: columns === 2 ? '46%' : '22%' }, pressed && styles.pressed]}
              >
                <View style={[styles.addCircle, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}><Text style={[styles.addIcon, { fontSize: Math.round(avatarSize * 0.45) }]}>＋</Text></View>
                <Text style={[styles.addLabel, { fontSize: layout.isTv ? 20 : 16 }]}>{copy.add}</Text>
              </Pressable>
            </View>

            {adding ? (
              <View style={styles.addPanel}>
                <TextInput
                  autoFocus
                  value={newProfileName}
                  onChangeText={setNewProfileName}
                  placeholder={copy.name}
                  placeholderTextColor="#777a81"
                  maxLength={30}
                  autoCorrect={false}
                  onSubmitEditing={addNow}
                  style={styles.input}
                />
                <View style={styles.addActions}>
                  <FocusButton active={Boolean(newProfileName.trim())} label={copy.create} onPress={addNow} />
                  <FocusButton label={copy.cancel} onPress={() => { setAdding(false); setNewProfileName(''); }} />
                </View>
              </View>
            ) : null}

            <View style={styles.manageWrap}>
              <FocusButton label={manageMode ? copy.done : copy.manage} active={manageMode} onPress={() => setManageMode(value => !value)} />
              {!Platform.isTV ? <FocusButton label="×" onPress={() => setVisible(false)} /> : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060606' },
  content: { flexGrow: 1, alignItems: 'center' },
  title: { color: '#f6f6f7', fontWeight: '900', letterSpacing: -1.2, textAlign: 'center' },
  grid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 34, marginTop: 58 },
  profileCell: { alignItems: 'center', gap: 12 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  avatarRing: { alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#222226' },
  avatarRingCurrent: { borderColor: '#f3f3f4' },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  avatarText: { color: '#ffffff', fontWeight: '900', letterSpacing: 1 },
  profileName: { color: '#f4f4f5', fontWeight: '800', maxWidth: '100%' },
  addCircle: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#303034', backgroundColor: '#0b0b0c' },
  addIcon: { color: '#8c8f96', fontWeight: '200' },
  addLabel: { color: '#92959c', fontWeight: '800', textAlign: 'center' },
  removeBadge: { position: 'absolute', top: -3, right: -3, width: 34, height: 34, borderRadius: 17, backgroundColor: '#e44d63', borderWidth: 3, borderColor: '#060606', alignItems: 'center', justifyContent: 'center' },
  removeBadgeText: { color: '#fff', fontSize: 24, lineHeight: 26, fontWeight: '500' },
  addPanel: { width: '100%', maxWidth: 520, marginTop: 42, padding: 16, borderRadius: 18, backgroundColor: '#171718', borderWidth: 1, borderColor: '#29292c' },
  input: { minHeight: 52, borderRadius: 13, paddingHorizontal: 15, backgroundColor: '#242425', color: '#f6f6f7', fontSize: 17 },
  addActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  manageWrap: { marginTop: 48, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
});
