import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AppLanguage } from '../types';
import { FocusButton } from './FocusButton';
import { theme } from './theme';

type Props = {
  language: AppLanguage;
  onAdd(name: string, server: string, username: string, password: string): Promise<void>;
  onMessage(message: string, isError?: boolean): void;
};

export function XtreamSourceForm({ language, onAdd, onMessage }: Props) {
  const [name, setName] = useState('');
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);

  const copy = useMemo(() => language === 'fr'
    ? {
        title: 'Xtream Codes',
        help: 'Connectez un abonnement IPTV que vous êtes autorisé à utiliser. Le mot de passe reste uniquement dans le stockage sécurisé de cet appareil.',
        name: 'Nom de la source',
        server: 'Serveur (http:// ou https://)',
        username: 'Nom d’utilisateur',
        password: 'Mot de passe',
        connect: 'Connecter Xtream',
        connecting: 'Connexion…',
        missing: 'Renseignez le serveur, le nom d’utilisateur et le mot de passe.',
        invalidServer: 'Le serveur Xtream doit commencer par http:// ou https://',
        added: 'Source Xtream vérifiée et ajoutée.',
        defaultName: 'Xtream IPTV',
      }
    : language === 'sq'
      ? {
          title: 'Xtream Codes',
          help: 'Lidh një abonim IPTV që ke të drejtë ta përdorësh. Fjalëkalimi ruhet vetëm në hapësirën e sigurt të kësaj pajisjeje.',
          name: 'Emri i burimit',
          server: 'Serveri (http:// ose https://)',
          username: 'Përdoruesi',
          password: 'Fjalëkalimi',
          connect: 'Lidh Xtream',
          connecting: 'Duke u lidhur…',
          missing: 'Plotëso serverin, përdoruesin dhe fjalëkalimin.',
          invalidServer: 'Serveri Xtream duhet të fillojë me http:// ose https://',
          added: 'Burimi Xtream u verifikua dhe u shtua.',
          defaultName: 'Xtream IPTV',
        }
      : {
          title: 'Xtream Codes',
          help: 'Connect an IPTV subscription you are authorized to use. The password stays only in secure storage on this device.',
          name: 'Source name',
          server: 'Server (http:// or https://)',
          username: 'Username',
          password: 'Password',
          connect: 'Connect Xtream',
          connecting: 'Connecting…',
          missing: 'Enter the server, username and password.',
          invalidServer: 'Xtream server must start with http:// or https://',
          added: 'Xtream source verified and added.',
          defaultName: 'Xtream IPTV',
        }, [language]);

  const connect = async () => {
    if (connecting) return;
    const cleanServer = server.trim();
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();
    if (!cleanServer || !cleanUsername || !cleanPassword) {
      onMessage(copy.missing, true);
      return;
    }
    if (!/^https?:\/\//i.test(cleanServer)) {
      onMessage(copy.invalidServer, true);
      return;
    }

    setConnecting(true);
    try {
      await onAdd(name.trim() || copy.defaultName, cleanServer, cleanUsername, cleanPassword);
      setName('');
      setServer('');
      setUsername('');
      setPassword('');
      onMessage(copy.added);
    } catch (error) {
      const detail = error instanceof Error && error.message ? error.message : 'Could not connect Xtream source.';
      onMessage(detail, true);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.badge}><Text style={styles.badgeText}>XC</Text></View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.help}>{copy.help}</Text>
        </View>
      </View>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={copy.name}
        placeholderTextColor={theme.muted}
        style={styles.input}
      />
      <TextInput
        value={server}
        onChangeText={setServer}
        placeholder={copy.server}
        placeholderTextColor={theme.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={styles.input}
      />
      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder={copy.username}
        placeholderTextColor={theme.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder={copy.password}
        placeholderTextColor={theme.muted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        textContentType="password"
        style={styles.input}
      />
      <View style={styles.actionRow}>
        <FocusButton label={connecting ? copy.connecting : copy.connect} active onPress={() => void connect()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 13,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 13,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  headerText: { flex: 1 },
  badge: { minWidth: 34, height: 34, borderRadius: 10, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  title: { color: theme.text, fontWeight: '900', fontSize: Platform.isTV ? 18 : 15 },
  help: { color: theme.muted, marginTop: 3, lineHeight: Platform.isTV ? 20 : 18, fontSize: Platform.isTV ? 13 : 11 },
  input: {
    minHeight: 44,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: '#31394d',
    borderRadius: 11,
    backgroundColor: theme.background,
    color: theme.text,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  actionRow: { alignItems: 'flex-start' },
});
