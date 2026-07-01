import { LocalizationMap } from 'discord.js';

export interface LocalizedStrings {
  en: string;
  de?: string;
  es?: string;
  fr?: string;
}

export const createLocalizationMap = (strings: LocalizedStrings): LocalizationMap => {
  const map: LocalizationMap = {};

  if (strings.de) map.de = strings.de;
  if (strings.es) map['es-ES'] = strings.es;
  if (strings.fr) map.fr = strings.fr;

  return map;
};

// Command name localizations
export const commandNames = {
  ping: {
    en: 'ping',
    de: 'ping',
    es: 'ping',
    fr: 'ping',
  },
  warn: {
    en: 'warn',
    de: 'warnen',
    es: 'advertir',
    fr: 'avertir',
  },
  moderation: {
    en: 'moderation',
    de: 'moderation',
    es: 'moderacion',
    fr: 'moderation',
  },
  config: {
    en: 'config',
    de: 'konfiguration',
    es: 'configuracion',
    fr: 'configuration',
  },
  giveaway: {
    en: 'gw',
    de: 'gewinnspiel',
    es: 'sorteo',
    fr: 'concours',
  },
  economy: {
    en: 'eco',
    de: 'wirtschaft',
    es: 'economia',
    fr: 'economie',
  },
  xp: {
    en: 'xp',
    de: 'xp',
    es: 'xp',
    fr: 'xp',
  },
  ticket: {
    en: 'ticket',
    de: 'ticket',
    es: 'ticket',
    fr: 'ticket',
  },
  language: {
    en: 'language',
    de: 'sprache',
    es: 'idioma',
    fr: 'langue',
  },
  utils: {
    en: 'utils',
    de: 'werkzeuge',
    es: 'utilidades',
    fr: 'utilitaires',
  },
  blacklist: {
    en: 'blacklist',
    de: 'sperrliste',
    es: 'listanegra',
    fr: 'listenoire',
  },
  fun: {
    en: 'fun',
    de: 'spass',
    es: 'diversion',
    fr: 'amusant',
  },
};

// Command descriptions
export const commandDescriptions = {
  ping: {
    en: 'Check bot latency',
    de: 'Überprüfe die Latenz des Bots',
    es: 'Comprueba la latencia del bot',
    fr: 'Vérifier la latence du bot',
  },
  warn: {
    en: 'Manage user warnings',
    de: 'Benutzerwarnungen verwalten',
    es: 'Gestionar advertencias de usuario',
    fr: 'Gérer les avertissements utilisateur',
  },
  moderation: {
    en: 'Moderation commands for server management',
    de: 'Moderationsbefehle für die Serververwaltung',
    es: 'Comandos de moderación para la gestión del servidor',
    fr: 'Commandes de modération pour la gestion du serveur',
  },
  config: {
    en: 'Configure bot settings for your server',
    de: 'Bot-Einstellungen für Ihren Server konfigurieren',
    es: 'Configurar ajustes del bot para tu servidor',
    fr: 'Configurer les paramètres du bot pour votre serveur',
  },
  giveaway: {
    en: 'Manage giveaways on your server',
    de: 'Gewinnspiele auf Ihrem Server verwalten',
    es: 'Gestionar sorteos en tu servidor',
    fr: 'Gérer les concours sur votre serveur',
  },
  economy: {
    en: 'Economy system commands',
    de: 'Wirtschaftssystem-Befehle',
    es: 'Comandos del sistema económico',
    fr: 'Commandes du système économique',
  },
  xp: {
    en: 'XP and leveling system',
    de: 'XP- und Levelsystem',
    es: 'Sistema de XP y niveles',
    fr: 'Système XP et de niveaux',
  },
  ticket: {
    en: 'Support ticket system',
    de: 'Support-Ticket-System',
    es: 'Sistema de tickets de soporte',
    fr: 'Système de tickets de support',
  },
  language: {
    en: 'Language preferences',
    de: 'Spracheinstellungen',
    es: 'Preferencias de idioma',
    fr: 'Préférences linguistiques',
  },
  utils: {
    en: 'Utility commands',
    de: 'Nützliche Befehle',
    es: 'Comandos de utilidad',
    fr: 'Commandes utilitaires',
  },
  blacklist: {
    en: 'Manage bot blacklist',
    de: 'Bot-Sperrliste verwalten',
    es: 'Gestionar lista negra del bot',
    fr: 'Gérer la liste noire du bot',
  },
  fun: {
    en: 'Fun and entertainment commands',
    de: 'Spaß- und Unterhaltungsbefehle',
    es: 'Comandos de diversión y entretenimiento',
    fr: 'Commandes amusantes et de divertissement',
  },
};

// Subcommand localizations
export const subcommandDescriptions = {
  xp: {
    rank: {
      en: 'View your XP rank card',
      de: 'Deine XP-Rangkarte anzeigen',
      es: 'Ver tu tarjeta de rango XP',
      fr: 'Voir votre carte de rang XP',
    },
    leaderboard: {
      en: 'View the server XP leaderboard',
      de: 'Die Server-XP-Bestenliste anzeigen',
      es: 'Ver la tabla de clasificación de XP del servidor',
      fr: 'Voir le classement XP du serveur',
    },
    configuration: {
      en: 'View current XP configuration',
      de: 'Aktuelle XP-Konfiguration anzeigen',
      es: 'Ver la configuración actual de XP',
      fr: 'Voir la configuration XP actuelle',
    },
    card: {
      en: 'Customize your rank card colors',
      de: 'Farben deiner Rangkarte anpassen',
      es: 'Personalizar los colores de tu tarjeta de rango',
      fr: 'Personnaliser les couleurs de votre carte de rang',
    },
  },
  utils: {
    avatar: {
      en: "Get a user's avatar",
      de: 'Avatar eines Benutzers abrufen',
      es: 'Obtener el avatar de un usuario',
      fr: "Obtenir l'avatar d'un utilisateur",
    },
    banner: {
      en: "Get a user's banner",
      de: 'Banner eines Benutzers abrufen',
      es: 'Obtener el banner de un usuario',
      fr: "Obtenir la bannière d'un utilisateur",
    },
    steam: {
      en: 'Get Steam profile information',
      de: 'Steam-Profilinformationen abrufen',
      es: 'Obtener información del perfil de Steam',
      fr: 'Obtenir les informations du profil Steam',
    },
    userinfo: {
      en: 'Get detailed user information',
      de: 'Detaillierte Benutzerinformationen abrufen',
      es: 'Obtener información detallada del usuario',
      fr: "Obtenir des informations détaillées sur l'utilisateur",
    },
    whois: {
      en: 'Look up user by ID',
      de: 'Benutzer nach ID suchen',
      es: 'Buscar usuario por ID',
      fr: 'Rechercher un utilisateur par ID',
    },
    roleinfo: {
      en: 'Get role information',
      de: 'Rolleninformationen abrufen',
      es: 'Obtener información del rol',
      fr: 'Obtenir des informations sur le rôle',
    },
    serverinfo: {
      en: 'Get server information',
      de: 'Serverinformationen abrufen',
      es: 'Obtener información del servidor',
      fr: 'Obtenir des informations sur le serveur',
    },
    help: {
      en: 'Get help for commands',
      de: 'Hilfe zu Befehlen erhalten',
      es: 'Obtener ayuda para los comandos',
      fr: "Obtenir de l'aide pour les commandes",
    },
    support: {
      en: 'Get support server link',
      de: 'Support-Server-Link erhalten',
      es: 'Obtener enlace del servidor de soporte',
      fr: 'Obtenir le lien du serveur de support',
    },
    stats: {
      en: 'View bot statistics and system information',
      de: 'Bot-Statistiken und Systeminformationen anzeigen',
      es: 'Ver estadísticas del bot e información del sistema',
      fr: 'Voir les statistiques du bot et les informations système',
    },
  },
  language: {
    available: {
      en: 'List available languages',
      de: 'Verfügbare Sprachen auflisten',
      es: 'Listar idiomas disponibles',
      fr: 'Lister les langues disponibles',
    },
    current: {
      en: 'Show current language',
      de: 'Aktuelle Sprache anzeigen',
      es: 'Mostrar idioma actual',
      fr: 'Afficher la langue actuelle',
    },
    set: {
      en: 'Set preferred language',
      de: 'Bevorzugte Sprache festlegen',
      es: 'Establecer idioma preferido',
      fr: 'Définir la langue préférée',
    },
  },
  ticket: {
    panel: {
      group: {
        en: 'Manage ticket panels',
        de: 'Ticket-Panels verwalten',
        es: 'Gestionar paneles de tickets',
        fr: 'Gérer les panneaux de tickets',
      },
      create: {
        en: 'Create a new ticket panel configuration',
        de: 'Eine neue Ticket-Panel-Konfiguration erstellen',
        es: 'Crear una nueva configuración de panel de tickets',
        fr: 'Créer une nouvelle configuration de panneau de tickets',
      },
      load: {
        en: 'Load and send a ticket panel',
        de: 'Ein Ticket-Panel laden und senden',
        es: 'Cargar y enviar un panel de tickets',
        fr: 'Charger et envoyer un panneau de tickets',
      },
      delete: {
        en: 'Delete a ticket panel',
        de: 'Ein Ticket-Panel löschen',
        es: 'Eliminar un panel de tickets',
        fr: 'Supprimer un panneau de tickets',
      },
      list: {
        en: 'List all ticket panels in this server',
        de: 'Alle Ticket-Panels auf diesem Server auflisten',
        es: 'Listar todos los paneles de tickets en este servidor',
        fr: 'Lister tous les panneaux de tickets de ce serveur',
      },
      edit: {
        en: 'Edit an existing ticket panel',
        de: 'Ein bestehendes Ticket-Panel bearbeiten',
        es: 'Editar un panel de tickets existente',
        fr: 'Modifier un panneau de tickets existant',
      },
      add_dept: {
        en: 'Add a department to a ticket panel',
        de: 'Eine Abteilung zu einem Ticket-Panel hinzufügen',
        es: 'Añadir un departamento a un panel de tickets',
        fr: 'Ajouter un département à un panneau de tickets',
      },
      list_depts: {
        en: 'List all departments for a ticket panel',
        de: 'Alle Abteilungen für ein Ticket-Panel auflisten',
        es: 'Listar todos los departamentos de un panel de tickets',
        fr: 'Lister tous les départements pour un panneau de tickets',
      },
      remove_dept: {
        en: 'Remove a department from a ticket panel',
        de: 'Eine Abteilung aus einem Ticket-Panel entfernen',
        es: 'Eliminar un departamento de un panel de tickets',
        fr: "Supprimer un département d'un panneau de tickets",
      },
    },
    claim: {
      en: 'Claim a ticket (for support staff)',
      de: 'Ein Ticket beanspruchen (für Support-Mitarbeiter)',
      es: 'Reclamar un ticket (para personal de soporte)',
      fr: 'Réclamer un ticket (pour le personnel de support)',
    },
    close: {
      en: 'Close a ticket',
      de: 'Ein Ticket schließen',
      es: 'Cerrar un ticket',
      fr: 'Fermer un ticket',
    },
  },
  fun: {
    meme: {
      en: 'Get a random meme',
      de: 'Ein zufälliges Meme erhalten',
      es: 'Obtener un meme aleatorio',
      fr: 'Obtenir un mème aléatoire',
    },
    fact: {
      en: 'Get a random fact',
      de: 'Eine zufällige Tatsache erhalten',
      es: 'Obtener un dato aleatorio',
      fr: 'Obtenir un fait aléatoire',
    },
    quote: {
      en: 'Get a random quote',
      de: 'Ein zufälliges Zitat erhalten',
      es: 'Obtener una cita aleatoria',
      fr: 'Obtenir une citation aléatoire',
    },
    joke: {
      en: 'Get a random joke',
      de: 'Einen zufälligen Witz erhalten',
      es: 'Obtener un chiste aleatorio',
      fr: 'Obtenir une blague aléatoire',
    },
    dadjoke: {
      en: 'Get a random dad joke',
      de: 'Einen zufälligen Dad-Joke erhalten',
      es: 'Obtener un chiste de papá aleatorio',
      fr: 'Obtenir une blague de papa aléatoire',
    },
  },
  warn: {
    create: {
      en: 'Issue a warning to a user',
      de: 'Eine Warnung an einen Benutzer ausgeben',
      es: 'Emitir una advertencia a un usuario',
      fr: 'Émettre un avertissement à un utilisateur',
    },
    edit: {
      en: 'Edit an existing warning',
      de: 'Eine bestehende Warnung bearbeiten',
      es: 'Editar una advertencia existente',
      fr: 'Modifier un avertissement existant',
    },
    lookup: {
      en: 'Look up a specific warning',
      de: 'Eine bestimmte Warnung nachschlagen',
      es: 'Buscar una advertencia específica',
      fr: 'Rechercher un avertissement spécifique',
    },
    view: {
      en: 'View all warnings for a user',
      de: 'Alle Warnungen für einen Benutzer anzeigen',
      es: 'Ver todas las advertencias de un usuario',
      fr: 'Voir tous les avertissements pour un utilisateur',
    },
    purge: {
      en: 'Remove all warnings for a user',
      de: 'Alle Warnungen eines Benutzers entfernen',
      es: 'Eliminar todas las advertencias de un usuario',
      fr: 'Supprimer tous les avertissements d’un utilisateur',
    },
    delete: {
      en: 'Delete a warning by ID',
      de: 'Eine Warnung anhand der ID löschen',
      es: 'Eliminar una advertencia por ID',
      fr: 'Supprimer un avertissement par identifiant',
    },
    automation: {
      group: {
        en: 'Manage warning automations',
        de: 'Warnungsautomatisierungen verwalten',
        es: 'Gestionar automatizaciones de advertencia',
        fr: "Gérer les automatisations d'avertissement",
      },
      create: {
        en: 'Create a warning automation',
        de: 'Eine Warnungsautomatisierung erstellen',
        es: 'Crear una automatización de advertencia',
        fr: "Créer une automatisation d'avertissement",
      },
      view: {
        en: 'View all warning automations',
        de: 'Alle Warnungsautomatisierungen anzeigen',
        es: 'Ver todas las automatizaciones de advertencia',
        fr: "Voir toutes les automatisations d'avertissement",
      },
      delete: {
        en: 'Delete a warning automation',
        de: 'Eine Warnungsautomatisierung löschen',
        es: 'Eliminar una automatización de advertencia',
        fr: "Supprimer une automatisation d'avertissement",
      },
    },
  },
  moderation: {
    ban: {
      en: 'Ban a user from the server',
      de: 'Einen Benutzer vom Server verbannen',
      es: 'Banear a un usuario del servidor',
      fr: 'Bannir un utilisateur du serveur',
    },
    kick: {
      en: 'Kick a user from the server',
      de: 'Einen Benutzer vom Server kicken',
      es: 'Expulsar a un usuario del servidor',
      fr: 'Expulser un utilisateur du serveur',
    },
    timeout: {
      en: 'Timeout a user',
      de: 'Einen Benutzer in Timeout setzen',
      es: 'Poner a un usuario en tiempo fuera',
      fr: 'Mettre un utilisateur en timeout',
    },
    resetxp: {
      en: "Reset a user's XP",
      de: 'XP eines Benutzers zurücksetzen',
      es: 'Reiniciar el XP de un usuario',
      fr: "Réinitialiser l'XP d'un utilisateur",
    },
  },
  economy: {
    balance: {
      en: "Check your or another user's balance",
      es: 'Consulta tu saldo o el de otro usuario',
      fr: "Vérifiez votre solde ou celui d'un autre utilisateur",
      de: 'Überprüfe dein Guthaben oder das eines anderen Benutzers',
    },
    daily: {
      en: 'Claim your daily reward',
      es: 'Reclama tu recompensa diaria',
      fr: 'Réclamez votre récompense quotidienne',
      de: 'Fordere deine tägliche Belohnung an',
    },
    work: {
      en: 'Work to earn money',
      es: 'Trabaja para ganar dinero',
      fr: "Travaillez pour gagner de l'argent",
      de: 'Arbeite um Geld zu verdienen',
    },
    rob: {
      en: 'Attempt to rob another user',
      es: 'Intenta robar a otro usuario',
      fr: 'Tentez de voler un autre utilisateur',
      de: 'Versuche einen anderen Benutzer auszurauben',
    },
    gamble: {
      group: {
        en: 'Gambling games',
        es: 'Juegos de azar',
        fr: 'Jeux de hasard',
        de: 'Glücksspiele',
      },
      dice: {
        en: 'Roll dice against the dealer',
        es: 'Tira los dados contra el crupier',
        fr: 'Lancez les dés contre le croupier',
        de: 'Würfle gegen den Dealer',
      },
      coinflip: {
        en: 'Flip a coin',
        es: 'Lanza una moneda',
        fr: 'Lancez une pièce',
        de: 'Wirf eine Münze',
      },
      slots: {
        en: 'Play the slot machine',
        es: 'Juega a la máquina tragamonedas',
        fr: 'Jouez à la machine à sous',
        de: 'Spiele am Spielautomaten',
      },
      blackjack: {
        en: 'Play blackjack against the dealer',
        es: 'Juega al blackjack contra el crupier',
        fr: 'Jouez au blackjack contre le croupier',
        de: 'Spiele Blackjack gegen den Dealer',
      },
      roulette: {
        en: 'Play roulette',
        es: 'Juega a la ruleta',
        fr: 'Jouez à la roulette',
        de: 'Spiele Roulette',
      },
    },
    shop: {
      group: {
        en: 'Shop commands',
        es: 'Comandos de la tienda',
        fr: 'Commandes de la boutique',
        de: 'Shop-Befehle',
      },
      view: {
        en: 'View available shop items',
        es: 'Ver artículos disponibles en la tienda',
        fr: 'Voir les articles disponibles dans la boutique',
        de: 'Verfügbare Shop-Artikel anzeigen',
      },
      buy: {
        en: 'Purchase an item from the shop',
        es: 'Comprar un artículo de la tienda',
        fr: 'Acheter un article dans la boutique',
        de: 'Einen Artikel aus dem Shop kaufen',
      },
      inventory: {
        en: 'View your purchased items',
        es: 'Ver tus artículos comprados',
        fr: 'Voir vos articles achetés',
        de: 'Ihre gekauften Artikel anzeigen',
      },
    },
  },
};

// Option descriptions
export const optionDescriptions = {
  page: {
    en: 'Page number to view',
    de: 'Anzuzeigende Seitennummer',
    es: 'Número de página a ver',
    fr: 'Numéro de page à voir',
  },
  role: {
    en: 'The role to get information for',
    de: 'Die Rolle, für die Informationen abgerufen werden sollen',
    es: 'El rol del que obtener información',
    fr: 'Le rôle dont obtenir les informations',
  },
  username: {
    en: 'Steam username or profile URL',
    de: 'Steam-Benutzername oder Profil-URL',
    es: 'Nombre de usuario o URL del perfil de Steam',
    fr: "Nom d'utilisateur ou URL du profil Steam",
  },
  user_id: {
    en: 'The user ID to look up',
    de: 'Die zu suchende Benutzer-ID',
    es: 'El ID de usuario a buscar',
    fr: "L'ID utilisateur à rechercher",
  },
  command: {
    en: 'The command to get help for',
    de: 'Der Befehl, für den Hilfe benötigt wird',
    es: 'El comando para obtener ayuda',
    fr: "La commande pour laquelle obtenir de l'aide",
  },
  language: {
    en: 'The language to select',
    de: 'Die auszuwählende Sprache',
    es: 'El idioma a seleccionar',
    fr: 'La langue à sélectionner',
  },
  user: {
    en: 'The user to target',
    de: 'Der Zielbenutzer',
    es: 'El usuario objetivo',
    fr: "L'utilisateur cible",
  },
  title: {
    en: 'Title of the warning',
    de: 'Titel der Warnung',
    es: 'Título de la advertencia',
    fr: "Titre de l'avertissement",
  },
  description: {
    en: 'Description of the warning',
    de: 'Beschreibung der Warnung',
    es: 'Descripción de la advertencia',
    fr: "Description de l'avertissement",
  },
  level: {
    en: 'Warning level (1-10)',
    de: 'Warnstufe (1-10)',
    es: 'Nivel de advertencia (1-10)',
    fr: "Niveau d'avertissement (1-10)",
  },
  proof: {
    en: 'Proof attachment for the warning',
    de: 'Beweisanhang für die Warnung',
    es: 'Prueba adjunta para la advertencia',
    fr: "Preuve jointe pour l'avertissement",
  },
  warnid: {
    en: 'The warning ID',
    de: 'Die Warnungs-ID',
    es: 'El ID de advertencia',
    fr: "L'ID d'avertissement",
  },
  reason: {
    en: 'Reason for the action',
    de: 'Grund für die Aktion',
    es: 'Razón de la acción',
    fr: "Raison de l'action",
  },
  duration: {
    en: 'Duration of the action',
    de: 'Dauer der Aktion',
    es: 'Duración de la acción',
    fr: "Durée de l'action",
  },
  triggerType: {
    en: 'Trigger type for this automation',
    de: 'Auslöser-Typ für diese Automatisierung',
    es: 'Tipo de disparador para esta automatización',
    fr: 'Type de déclencheur pour cette automatisation',
  },
  triggerValue: {
    en: 'Value at which the automation triggers',
    de: 'Wert, bei dem die Automatisierung auslöst',
    es: 'Valor en el que se activa la automatización',
    fr: 'Valeur à laquelle l’automatisation se déclenche',
  },
  notifyChannel: {
    en: 'Channel that receives automation notifications',
    de: 'Kanal für Automatisierungsbenachrichtigungen',
    es: 'Canal que recibe las notificaciones de la automatización',
    fr: 'Salon recevant les notifications de l’automatisation',
  },
  balanceUser: {
    en: 'The user to check balance for',
    es: 'El usuario para verificar el saldo',
    fr: "L'utilisateur dont vérifier le solde",
    de: 'Der Benutzer, dessen Guthaben überprüft werden soll',
  },
  robUser: {
    en: 'The user to rob',
    es: 'El usuario a robar',
    fr: "L'utilisateur à voler",
    de: 'Der Benutzer zum Ausrauben',
  },
  bet: {
    en: 'Amount to bet',
    es: 'Cantidad a apostar',
    fr: 'Montant à parier',
    de: 'Einsatzbetrag',
  },
  coinflipChoice: {
    en: 'Heads or tails',
    es: 'Cara o cruz',
    fr: 'Pile ou face',
    de: 'Kopf oder Zahl',
  },
  rouletteType: {
    en: 'Type of bet',
    es: 'Tipo de apuesta',
    fr: 'Type de pari',
    de: 'Art der Wette',
  },
  rouletteNumber: {
    en: 'Specific number to bet on (0-36)',
    es: 'Número específico para apostar (0-36)',
    fr: 'Numéro spécifique sur lequel parier (0-36)',
    de: 'Spezifische Zahl zum Setzen (0-36)',
  },
  buyItem: {
    en: 'The item to purchase',
    es: 'El artículo a comprar',
    fr: "L'article à acheter",
    de: 'Der zu kaufende Artikel',
  },
  buyQuantity: {
    en: 'Quantity to purchase',
    es: 'Cantidad a comprar',
    fr: 'Quantité à acheter',
    de: 'Zu kaufende Menge',
  },
  automationid: {
    en: 'The automation ID to delete',
    de: 'Die zu löschende Automatisierungs-ID',
    es: 'El ID de automatización a eliminar',
    fr: "L'ID d'automatisation à supprimer",
  },
};

// Choice localizations
export const choiceLocalizations = {
  coinflip: {
    heads: { en: 'Heads', es: 'Cara', fr: 'Face', de: 'Kopf' },
    tails: { en: 'Tails', es: 'Cruz', fr: 'Pile', de: 'Zahl' },
  },
  roulette: {
    red: { en: 'Red', es: 'Rojo', fr: 'Rouge', de: 'Rot' },
    black: { en: 'Black', es: 'Negro', fr: 'Noir', de: 'Schwarz' },
    even: { en: 'Even', es: 'Par', fr: 'Pair', de: 'Gerade' },
    odd: { en: 'Odd', es: 'Impar', fr: 'Impair', de: 'Ungerade' },
    low: { en: 'Low (1-18)', es: 'Bajo (1-18)', fr: 'Manque (1-18)', de: 'Niedrig (1-18)' },
    high: { en: 'High (19-36)', es: 'Alto (19-36)', fr: 'Passe (19-36)', de: 'Hoch (19-36)' },
    number: {
      en: 'Specific Number',
      es: 'Número específico',
      fr: 'Numéro spécifique',
      de: 'Spezifische Zahl',
    },
    dozen1: { en: '1st Dozen', es: '1ra Docena', fr: '1er Douzaine', de: '1. Dutzend' },
    dozen2: { en: '2nd Dozen', es: '2da Docena', fr: '2ème Douzaine', de: '2. Dutzend' },
    dozen3: { en: '3rd Dozen', es: '3ra Docena', fr: '3ème Douzaine', de: '3. Dutzend' },
  },
};
