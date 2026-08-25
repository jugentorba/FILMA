import type { AppLanguage, AudioLanguage } from './types';

export const APP_LANGUAGE_OPTIONS: Array<{ code: AppLanguage; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'sq', label: 'Shqip' },
];

export const AUDIO_LANGUAGE_OPTIONS: Array<{ code: AudioLanguage; labels: Record<AppLanguage, string> }> = [
  { code: 'en', labels: { en: 'English', fr: 'Anglais', sq: 'Anglisht' } },
  { code: 'fr', labels: { en: 'French', fr: 'Français', sq: 'Frëngjisht' } },
  { code: 'sq', labels: { en: 'Albanian', fr: 'Albanais', sq: 'Shqip' } },
  { code: 'it', labels: { en: 'Italian', fr: 'Italien', sq: 'Italisht' } },
  { code: 'es', labels: { en: 'Spanish', fr: 'Espagnol', sq: 'Spanjisht' } },
  { code: 'de', labels: { en: 'German', fr: 'Allemand', sq: 'Gjermanisht' } },
  { code: 'tr', labels: { en: 'Turkish', fr: 'Turc', sq: 'Turqisht' } },
];

const strings = {
  en: {
    movies: 'Movies', liveTv: 'Live TV', youtube: 'YouTube', settings: 'Settings', dismiss: 'Dismiss', loading: 'Loading',
    play: 'Play', continue: 'Continue', favorites: 'Favorites', continueWatching: 'Continue Watching',
    searchPlaceholder: 'Search movies and series', searchResults: 'Search results', noSearchResults: 'No results found',
    homeEyebrow: 'WATCH YOUR WAY', homeEmptyTitle: 'Your cinema starts here',
    homeEmptyText: 'Add a Stremio-compatible movie source in Settings. FILMA will load real catalogs and playable titles from the sources you choose.',
    addMovieSource: 'Add movie source', sourceNeeded: 'Movie source unavailable',
    loadingCatalogs: 'Loading your catalogs…', loadingCatalogsHelp: 'FILMA is contacting your enabled movie sources and preparing their catalogs.',
    searchSourceError: 'Your configured sources could not complete this search.', sourceLoadError: 'Your enabled movie sources did not return a browseable catalog.',
    sourcesDisabledTitle: 'Your movie sources are paused', sourcesDisabledText: 'You have movie sources configured, but they are currently disabled. Enable one in Settings to load its catalogs.',
    retry: 'Retry', preferredAudio: 'Preferred audio', anyLanguage: 'Any language',
    youtubeTvSubtitle: 'YouTube built into FILMA for your TV', youtubeSearchPlaceholder: 'Search YouTube',
    youtubeTrending: 'Popular on YouTube', youtubeSearchResults: 'YouTube search results',
    youtubeNeedsKey: 'The YouTube section is ready, but this FILMA build still needs its YouTube Data API credential before it can load the official YouTube catalog.',
    youtubeLoadError: 'FILMA could not load YouTube right now.', youtubeSearchError: 'FILMA could not complete the YouTube search.',
    settingsTitle: 'Settings', settingsIntro: 'Personalize FILMA, connect sync, and manage your content sources.',
    languageTitle: 'Language & playback', appLanguage: 'App language', audioLanguages: 'Preferred audio languages',
    audioHelp: 'Choose one or more languages. FILMA prioritizes matching streams and passes a language filter to add-ons that support one.',
    syncTitle: 'Dropbox sync', syncHelp: 'Keep Continue Watching, favorites and sources synchronized across your devices.',
    connected: 'Connected', notConnected: 'Not connected', checking: 'Checking…', syncing: 'Syncing…', pairing: 'Pairing…',
    connectDropbox: 'Connect Dropbox', pairDropbox: 'Pair Dropbox', syncNow: 'Sync now', disconnect: 'Disconnect', lastSync: 'Last sync',
    liveSources: 'Live TV playlists', movieSources: 'Movie & series sources', addPlaylist: 'Add playlist', addAddon: 'Add source', remove: 'Remove',
    enable: 'Enable', disable: 'Disable', enabled: 'Enabled', disabled: 'Disabled',
    playlistName: 'Playlist name', addonName: 'Source name', manifestUrl: 'Stremio-compatible manifest.json URL',
    device: 'This installation', advanced: 'Device information',
  },
  fr: {
    movies: 'Films', liveTv: 'TV en direct', youtube: 'YouTube', settings: 'Réglages', dismiss: 'Fermer', loading: 'Chargement',
    play: 'Lire', continue: 'Continuer', favorites: 'Favoris', continueWatching: 'Continuer à regarder',
    searchPlaceholder: 'Rechercher films et séries', searchResults: 'Résultats', noSearchResults: 'Aucun résultat',
    homeEyebrow: 'REGARDEZ À VOTRE FAÇON', homeEmptyTitle: 'Votre cinéma commence ici',
    homeEmptyText: 'Ajoutez une source de films compatible Stremio dans les Réglages. FILMA chargera les vrais catalogues et titres lisibles des sources que vous choisissez.',
    addMovieSource: 'Ajouter une source', sourceNeeded: 'Source de films indisponible',
    loadingCatalogs: 'Chargement de vos catalogues…', loadingCatalogsHelp: 'FILMA contacte vos sources de films actives et prépare leurs catalogues.',
    searchSourceError: 'Vos sources configurées n’ont pas pu terminer cette recherche.', sourceLoadError: 'Vos sources de films actives n’ont renvoyé aucun catalogue consultable.',
    sourcesDisabledTitle: 'Vos sources de films sont en pause', sourcesDisabledText: 'Des sources de films sont configurées mais actuellement désactivées. Activez-en une dans les Réglages pour charger ses catalogues.',
    retry: 'Réessayer', preferredAudio: 'Audio préféré', anyLanguage: 'Toutes les langues',
    youtubeTvSubtitle: 'YouTube intégré à FILMA pour votre téléviseur', youtubeSearchPlaceholder: 'Rechercher sur YouTube',
    youtubeTrending: 'Populaire sur YouTube', youtubeSearchResults: 'Résultats YouTube',
    youtubeNeedsKey: 'La section YouTube est prête, mais cette version de FILMA a encore besoin de son identifiant YouTube Data API pour charger le catalogue officiel YouTube.',
    youtubeLoadError: 'FILMA ne peut pas charger YouTube pour le moment.', youtubeSearchError: 'FILMA n’a pas pu terminer la recherche YouTube.',
    settingsTitle: 'Réglages', settingsIntro: 'Personnalisez FILMA, connectez la synchronisation et gérez vos sources.',
    languageTitle: 'Langue et lecture', appLanguage: 'Langue de l’application', audioLanguages: 'Langues audio préférées',
    audioHelp: 'Choisissez une ou plusieurs langues. FILMA donne la priorité aux flux correspondants et utilise le filtre de langue des extensions qui le prennent en charge.',
    syncTitle: 'Synchronisation Dropbox', syncHelp: 'Synchronisez la reprise de lecture, les favoris et les sources entre vos appareils.',
    connected: 'Connecté', notConnected: 'Non connecté', checking: 'Vérification…', syncing: 'Synchronisation…', pairing: 'Association…',
    connectDropbox: 'Connecter Dropbox', pairDropbox: 'Associer Dropbox', syncNow: 'Synchroniser', disconnect: 'Déconnecter', lastSync: 'Dernière synchro',
    liveSources: 'Playlists TV en direct', movieSources: 'Sources films et séries', addPlaylist: 'Ajouter la playlist', addAddon: 'Ajouter la source', remove: 'Supprimer',
    enable: 'Activer', disable: 'Désactiver', enabled: 'Activée', disabled: 'Désactivée',
    playlistName: 'Nom de la playlist', addonName: 'Nom de la source', manifestUrl: 'URL manifest.json compatible Stremio',
    device: 'Cette installation', advanced: 'Informations appareil',
  },
  sq: {
    movies: 'Filma', liveTv: 'TV Live', youtube: 'YouTube', settings: 'Cilësimet', dismiss: 'Mbyll', loading: 'Duke ngarkuar',
    play: 'Luaj', continue: 'Vazhdo', favorites: 'Të preferuarat', continueWatching: 'Vazhdo shikimin',
    searchPlaceholder: 'Kërko filma dhe seriale', searchResults: 'Rezultatet', noSearchResults: 'Nuk u gjet asgjë',
    homeEyebrow: 'SHIKO SI TË DUASH', homeEmptyTitle: 'Kinemaja jote fillon këtu',
    homeEmptyText: 'Shto te Cilësimet një burim filmash të përputhshëm me Stremio. FILMA do të ngarkojë katalogët dhe titujt realë nga burimet që zgjedh.',
    addMovieSource: 'Shto burim filmash', sourceNeeded: 'Burimi i filmave nuk është i disponueshëm',
    loadingCatalogs: 'Duke ngarkuar katalogët…', loadingCatalogsHelp: 'FILMA po kontakton burimet aktive të filmave dhe po përgatit katalogët.',
    searchSourceError: 'Burimet e konfiguruara nuk e përfunduan dot këtë kërkim.', sourceLoadError: 'Burimet aktive të filmave nuk kthyen katalog të shfletueshëm.',
    sourcesDisabledTitle: 'Burimet e filmave janë në pauzë', sourcesDisabledText: 'Ke burime filmash të konfiguruara, por janë të çaktivizuara. Aktivizo një te Cilësimet për të ngarkuar katalogët.',
    retry: 'Provo përsëri', preferredAudio: 'Audio e preferuar', anyLanguage: 'Çdo gjuhë',
    youtubeTvSubtitle: 'YouTube i integruar në FILMA për televizorin tënd', youtubeSearchPlaceholder: 'Kërko në YouTube',
    youtubeTrending: 'Popullore në YouTube', youtubeSearchResults: 'Rezultatet e YouTube',
    youtubeNeedsKey: 'Seksioni YouTube është gati, por ky version i FILMA ka ende nevojë për kredencialin YouTube Data API për të ngarkuar katalogun zyrtar të YouTube.',
    youtubeLoadError: 'FILMA nuk mund ta ngarkojë YouTube tani.', youtubeSearchError: 'FILMA nuk mund ta përfundonte kërkimin në YouTube.',
    settingsTitle: 'Cilësimet', settingsIntro: 'Personalizo FILMA, lidh sinkronizimin dhe menaxho burimet e përmbajtjes.',
    languageTitle: 'Gjuha dhe luajtja', appLanguage: 'Gjuha e aplikacionit', audioLanguages: 'Gjuhët e preferuara të audios',
    audioHelp: 'Zgjidh një ose më shumë gjuhë. FILMA u jep përparësi stream-eve që përputhen dhe përdor filtrin e gjuhës kur add-on-i e mbështet.',
    syncTitle: 'Sinkronizimi Dropbox', syncHelp: 'Sinkronizo vazhdimin e shikimit, të preferuarat dhe burimet mes pajisjeve.',
    connected: 'Lidhur', notConnected: 'Pa lidhur', checking: 'Duke kontrolluar…', syncing: 'Duke sinkronizuar…', pairing: 'Duke çiftuar…',
    connectDropbox: 'Lidh Dropbox', pairDropbox: 'Çifto Dropbox', syncNow: 'Sinkronizo tani', disconnect: 'Shkëput', lastSync: 'Sinkronizimi i fundit',
    liveSources: 'Playlistat TV Live', movieSources: 'Burimet e filmave dhe serialeve', addPlaylist: 'Shto playlist', addAddon: 'Shto burim', remove: 'Hiq',
    enable: 'Aktivizo', disable: 'Çaktivizo', enabled: 'Aktiv', disabled: 'Joaktiv',
    playlistName: 'Emri i playlistës', addonName: 'Emri i burimit', manifestUrl: 'URL manifest.json e përputhshme me Stremio',
    device: 'Ky instalim', advanced: 'Informacioni i pajisjes',
  },
} as const;

export type UiStrings = typeof strings.en;

export function stringsFor(language: AppLanguage): UiStrings {
  return strings[language] as UiStrings;
}

export function audioLanguageLabel(code: AudioLanguage, appLanguage: AppLanguage): string {
  return AUDIO_LANGUAGE_OPTIONS.find(option => option.code === code)?.labels[appLanguage] ?? code.toUpperCase();
}
