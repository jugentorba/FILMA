import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { validatePlaybackAddon } from '../services/addonValidation';
import { discoverWebsiteMovieSource } from '../services/websiteSourceDiscovery';
import { useFilma } from '../store/FilmaContext';
import { FocusButton } from '../ui/FocusButton';
import { theme } from '../ui/theme';
import { useResponsiveLayout } from '../ui/useResponsiveLayout';

function copyFor(language: 'en' | 'fr' | 'sq') {
  if (language === 'fr') return {
    title: 'Sources films & séries',
    automaticTitle: 'FILMA Films & Séries — Automatique',
    automaticHelp: 'FILMA découvre et actualise automatiquement les fournisseurs compatibles en arrière-plan. Aucune configuration n’est nécessaire.',
    automatic: 'Automatique',
    providerTitle: 'Ajouter un fournisseur',
    providerHelp: 'Ajoutez directement un fournisseur compatible. Collez son URL manifest.json ou l’adresse de base du fournisseur ; FILMA vérifiera la source avant de l’enregistrer.',
    providerName: 'Nom du fournisseur (facultatif)',
    providerUrl: 'https://fournisseur.com/manifest.json',
    addProvider: 'Ajouter le fournisseur',
    checkingProvider: 'Vérification…',
    providerAdded: 'Fournisseur ajouté.',
    providerUnsupported: 'Ce fournisseur n’a pas de manifeste films/séries compatible.',
    customTitle: 'Source site / fournisseur',
    customHelp: 'Collez l’adresse d’un site ou fournisseur. FILMA recherchera une API ou un manifeste public compatible. Les pages vidéo protégées ne sont pas extraites.',
    sourceName: 'Nom (facultatif)',
    sourceUrl: 'https://exemple.com',
    add: 'Ajouter la source',
    checking: 'Recherche…',
    added: 'Source ajoutée.',
    invalid: 'Entrez une adresse http:// ou https:// valide.',
    unsupported: 'Aucun flux public compatible n’a été trouvé à cette adresse.',
    saved: 'Fournisseurs / sources ajoutés',
    enabled: 'Activée', disabled: 'Désactivée', enable: 'Activer', disable: 'Désactiver', remove: 'Supprimer',
  };
  if (language === 'sq') return {
    title: 'Burimet e filmave & serialeve',
    automaticTitle: 'FILMA Filma & Seriale — Automatik',
    automaticHelp: 'FILMA zbulon dhe rifreskon automatikisht ofruesit e përputhshëm në sfond. Nuk duhet të konfigurosh asgjë.',
    automatic: 'Automatik',
    providerTitle: 'Shto provider',
    providerHelp: 'Shto direkt një provider të përputhshëm. Vendos URL-në manifest.json ose adresën bazë të providerit; FILMA e kontrollon para se ta ruajë.',
    providerName: 'Emri i providerit (opsional)',
    providerUrl: 'https://provider.com/manifest.json',
    addProvider: 'Shto providerin',
    checkingProvider: 'Duke kontrolluar…',
    providerAdded: 'Provideri u shtua.',
    providerUnsupported: 'Ky provider nuk ka manifest të përputhshëm për filma/seriale.',
    customTitle: 'Burim website / provider',
    customHelp: 'Vendos adresën e një website-i ose provideri. FILMA kërkon një API ose manifest publik të përputhshëm. Faqet e mbrojtura të videove nuk ekstraktohen.',
    sourceName: 'Emri (opsional)',
    sourceUrl: 'https://shembull.com',
    add: 'Shto burimin',
    checking: 'Duke kërkuar…',
    added: 'Burimi u shtua.',
    invalid: 'Vendos një adresë të vlefshme http:// ose https://.',
    unsupported: 'Nuk u gjet një burim publik i përputhshëm në këtë adresë.',
    saved: 'Providerë / burime të shtuara',
    enabled: 'Aktiv', disabled: 'Joaktiv', enable: 'Aktivizo', disable: 'Çaktivizo', remove: 'Hiq',
  };
  return {
    title: 'Movies & Series sources',
    automaticTitle: 'FILMA Movies & Series — Automatic',
    automaticHelp: 'FILMA discovers and refreshes compatible providers automatically in the background. No setup is required.',
    automatic: 'Automatic',
    providerTitle: 'Add Provider',
    providerHelp: 'Add a compatible provider directly. Paste its manifest.json URL or provider base address; FILMA validates it before saving.',
    providerName: 'Provider name (optional)',
    providerUrl: 'https://provider.example/manifest.json',
    addProvider: 'Add Provider',
    checkingProvider: 'Checking…',
    providerAdded: 'Provider added.',
    providerUnsupported: 'This provider does not expose a compatible movie/series manifest.',
    customTitle: 'Website / provider source',
    customHelp: 'Paste a website or provider address. FILMA looks for a compatible public API/feed/manifest. Protected video pages are not extracted.',
    sourceName: 'Name (optional)',
    sourceUrl: 'https://example.com',
    add: 'Add source',
    checking: 'Searching…',
    added: 'Source added.',
    invalid: 'Enter a valid http:// or https:// address.',
    unsupported: 'No compatible public movie feed was found at this address.',
    saved: 'Added providers / sources',
    enabled: 'Enabled', disabled: 'Disabled', enable: 'Enable', disable: 'Disable', remove: 'Remove',
  };
}

export function MovieSourceSettingsScreen() {
  const { state, addAddon, setAddonEnabled, removeAddon } = useFilma();
  const layout = useResponsiveLayout();
  const copy = useMemo(() => copyFor(state.preferences.appLanguage), [state.preferences.appLanguage]);
  const custom = useMemo(() => state.addons.filter(addon => !addon.deletedAt && !addon.id.startsWith('auto-stremio:')), [state.addons]);

  const [providerName, setProviderName] = useState('');
  const [providerUrl, setProviderUrl] = useState('');
  const [providerChecking, setProviderChecking] = useState(false);
  const [providerMessage, setProviderMessage] = useState<string>();
  const [providerError, setProviderError] = useState(false);

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState(false);

  const addProvider = async () => {
    if (providerChecking) return;
    const rawUrl = providerUrl.trim();
    if (!/^https?:\/\//i.test(rawUrl)) {
      setProviderError(true);
      setProviderMessage(copy.invalid);
      return;
    }

    setProviderChecking(true);
    setProviderMessage(undefined);
    const candidates = /\/manifest\.json(?:[?#].*)?$/i.test(rawUrl)
      ? [rawUrl]
      : [rawUrl, `${rawUrl.replace(/\/+$/, '')}/manifest.json`];

    try {
      for (const candidate of candidates) {
        try {
          const validation = await validatePlaybackAddon(candidate);
          if (!validation.valid) continue;
          addAddon(providerName.trim() || validation.name, candidate);
          setProviderName('');
          setProviderUrl('');
          setProviderError(false);
          setProviderMessage(copy.providerAdded);
          return;
        } catch {
          // Try the next candidate before declaring the provider unsupported.
        }
      }
      setProviderError(true);
      setProviderMessage(copy.providerUnsupported);
    } finally {
      setProviderChecking(false);
    }
  };

  const addWebsiteSource = async () => {
    if (checking) return;
    if (!/^https?:\/\//i.test(url.trim())) {
      setError(true);
      setMessage(copy.invalid);
      return;
    }
    setChecking(true);
    setMessage(undefined);
    try {
      const result = await discoverWebsiteMovieSource(url.trim());
      if (!result.valid) {
        setError(true);
        setMessage(result.reason === 'invalid-url' ? copy.invalid : copy.unsupported);
        return;
      }
      addAddon(name.trim() || result.name, result.manifestUrl);
      setName('');
      setUrl('');
      setError(false);
      setMessage(copy.added);
    } catch {
      setError(true);
      setMessage(copy.unsupported);
    } finally {
      setChecking(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingHorizontal: layout.horizontalPadding, paddingTop: layout.isTv ? 28 : 20, paddingBottom: 100 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>{copy.title}</Text>

      <View style={styles.card}>
        <View style={styles.titleLine}>
          <Text style={styles.cardTitle}>{copy.automaticTitle}</Text>
          <View style={styles.goodTag}><Text style={styles.goodTagText}>{copy.automatic}</Text></View>
        </View>
        <Text style={styles.help}>{copy.automaticHelp}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{copy.providerTitle}</Text>
        <Text style={styles.help}>{copy.providerHelp}</Text>
        <TextInput value={providerName} onChangeText={setProviderName} placeholder={copy.providerName} placeholderTextColor={theme.muted} style={styles.input} />
        <TextInput value={providerUrl} onChangeText={setProviderUrl} placeholder={copy.providerUrl} placeholderTextColor={theme.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
        <FocusButton active label={providerChecking ? copy.checkingProvider : copy.addProvider} onPress={() => void addProvider()} />
        {providerMessage ? <Text style={[styles.message, providerError && styles.error]}>{providerMessage}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{copy.customTitle}</Text>
        <Text style={styles.help}>{copy.customHelp}</Text>
        <TextInput value={name} onChangeText={setName} placeholder={copy.sourceName} placeholderTextColor={theme.muted} style={styles.input} />
        <TextInput value={url} onChangeText={setUrl} placeholder={copy.sourceUrl} placeholderTextColor={theme.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
        <FocusButton active label={checking ? copy.checking : copy.add} onPress={() => void addWebsiteSource()} />
        {message ? <Text style={[styles.message, error && styles.error]}>{message}</Text> : null}
      </View>

      {custom.length ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{copy.saved}</Text>
          {custom.map(item => (
            <View key={item.id} style={styles.sourceRow}>
              <View style={styles.sourceMain}>
                <Text style={styles.sourceName}>{item.name}</Text>
                <Text numberOfLines={1} style={styles.sourceUrl}>{item.manifestUrl}</Text>
                <Text style={styles.status}>{item.enabled ? copy.enabled : copy.disabled}</Text>
              </View>
              <View style={styles.actions}>
                <FocusButton compact label={item.enabled ? copy.disable : copy.enable} onPress={() => setAddonEnabled(item.id, !item.enabled)} />
                <FocusButton compact label={copy.remove} onPress={() => removeAddon(item.id)} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080808' },
  pageTitle: { color: '#f7f7f8', fontSize: Platform.isTV ? 34 : 27, fontWeight: '900', letterSpacing: -0.6, marginBottom: 16 },
  card: { width: '100%', maxWidth: 920, borderRadius: 18, backgroundColor: '#171719', borderWidth: 1, borderColor: '#262629', padding: Platform.isTV ? 20 : 15, marginBottom: 13 },
  titleLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  cardTitle: { color: '#f3f3f5', fontSize: 17, fontWeight: '900' },
  help: { color: '#92949b', fontSize: 12, lineHeight: 18, marginTop: 7, marginBottom: 13 },
  goodTag: { borderRadius: 999, backgroundColor: '#153b2f', paddingHorizontal: 9, paddingVertical: 4 },
  goodTagText: { color: '#6ce0ab', fontSize: 9, fontWeight: '900' },
  input: { width: '100%', minHeight: 46, borderWidth: 1, borderColor: '#303034', borderRadius: 12, backgroundColor: '#0c0c0d', color: '#f2f2f4', paddingHorizontal: 12, marginBottom: 9, fontSize: 13 },
  message: { color: '#72dfad', fontSize: 11, fontWeight: '800', marginTop: 10 },
  error: { color: '#fda4af' },
  sourceRow: { flexDirection: Platform.isTV ? 'row' : 'column', gap: 8, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2a2a2d' },
  sourceMain: { flex: 1 },
  sourceName: { color: '#f1f1f3', fontSize: 14, fontWeight: '800' },
  sourceUrl: { color: '#777a82', fontSize: 10, marginTop: 3 },
  status: { color: '#9b9da4', fontSize: 10, marginTop: 5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
});
