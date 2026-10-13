export type Lang = 'ru' | 'ky' | 'en';

export interface Translations {
  // Login
  loginTitle: string;
  loginSubtitlePhone: string;
  loginSubtitleOtp: (phone: string) => string;
  phoneLabel: string;
  phonePlaceholder: string;
  continueBtn: string;
  sending: string;
  otpLabel: string;
  otpPlaceholder: string;
  nameLabel: string;
  namePlaceholder: string;
  welcomeBack: string;
  devCodeLabel: string;
  devCodeHint: string;
  backBtn: string;
  signInBtn: string;
  checking: string;
  invalidPhone: string;
  emptyCode: string;
  loginSuccess: string;
  codeSent: string;
  authTabPhone: string;
  authTabPassword: string;
  authTabDemo: string;
  resendCodeIn: (sec: number) => string;
  resendCodeBtn: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  usernameLabel: string;
  usernamePlaceholder: string;
  loginOrEmailLabel: string;
  loginOrEmailPlaceholder: string;
  loginInputLabel: string;
  loginInputPlaceholder: string;
  regTitle: string;
  regSubtitle: string;
  regTypePhone: string;
  regTypeEmail: string;
  emailLabel: string;
  emailPlaceholder: string;
  otpSentTo: (target: string, channel: 'email' | 'phone') => string;
  sendOtpBtn: string;
  dontHaveAccount: string;
  alreadyHaveAccount: string;
  registerBtn: string;
  quickDemoTitle: string;
  quickDemoSubtitle: string;

  // Main / Sidebar
  searchPlaceholder: string;
  foundUsers: string;
  noChatsTitle: string;
  noChatsHint: string;
  profileSettings: string;
  newChat: string;
  logout: string;
  youPrefix: string;

  // Chat window
  selectChatPlaceholder: string;
  typing: string;
  online: string;
  offlineRecent: string;
  offlineJustNow: string;
  offlineMinutesAgo: (min: number) => string;
  offlineToday: (time: string) => string;
  offlineYesterday: (time: string) => string;
  offlineDate: (date: string, time: string) => string;
  membersCount: (count: number, online?: number) => string;
  subscribersCount: (count: number) => string;
  channelOnlyAdmins: string;
  loadingHistory: string;
  inputPlaceholder: string;
  editLabel: string;
  emojis: string;
  audioRecording: (sec: number) => string;
  cancelBtn: string;
  sendBtn: string;
  editBtn: string;
  deleteBtn: string;
  replyBtn: string;
  replyTo: string;
  photoAttachment: string;
  fileAttachment: string;
  voiceAttachment: string;
  audioCall: string;
  videoCall: string;
  editedMark: string;
  today: string;
  yesterday: string;
  reactionBtn: string;
  pinBtn: string;
  unpinBtn: string;
  pinnedMessage: string;
  searchInChat: string;
  searchPlaceholderChat: string;
  searchNoResults: string;
  searchResultsCount: (current: number, total: number) => string;
  download: string;
  close: string;

  // Chat Info & Management
  chatInfo: string;
  userProfile: string;
  groupInfo: string;
  channelInfo: string;
  bio: string;
  phone: string;
  username: string;
  members: string;
  subscribers: string;
  addMember: string;
  searchUsersToAdd: string;
  addBtn: string;
  removeMember: string;
  makeAdmin: string;
  dismissAdmin: string;
  leaveChat: string;
  ownerRole: string;
  adminRole: string;
  memberRole: string;
  tabMembers: string;
  tabMedia: string;
  tabFiles: string;
  tabVoice: string;
  tabLinks: string;
  noSharedMedia: string;
  noSharedFiles: string;
  noSharedVoice: string;
  noSharedLinks: string;
  copiedToClipboard: string;
  copyText: string;

  // Custom Roles & Permissions
  customRoles: string;
  createRole: string;
  editRole: string;
  deleteRole: string;
  roleName: string;
  roleColor: string;
  assignRole: string;
  permissions: string;
  permManageRoles: string;
  permManageMembers: string;
  permDeleteMessages: string;
  permPinMessages: string;
  permChangeInfo: string;
  permPostMessages: string;
  noRolesYet: string;
  saveBtn: string;
  roleCreated: string;
  roleUpdated: string;
  roleDeleted: string;

  // Language switch
  language: string;

  // Sound settings
  soundEffects: string;
  soundEnabled: string;
  soundVolume: string;
  testSound: string;
  soundSent: string;
  soundReceived: string;

  // Push notifications
  pushNotifications: string;
  pushNotificationsDesc: string;
  pushPermissionGranted: string;
  pushPermissionDenied: string;
  pushPermissionDefault: string;
  enablePushBtn: string;
  testPushBtn: string;
  testPushTitle: string;
  testPushBody: string;
}

export const translations: Record<Lang, Translations> = {
  ru: {
    loginTitle: 'Вход в мессенджер',
    loginSubtitlePhone: 'Введите номер телефона для получения кода',
    loginSubtitleOtp: (phone) => `Введите проверочный код, отправленный на ${phone}`,
    phoneLabel: 'Номер телефона',
    phonePlaceholder: '+7 999 123 45 67',
    continueBtn: 'Продолжить',
    sending: 'Отправка...',
    otpLabel: 'Код подтверждения',
    otpPlaceholder: '6 цифр',
    nameLabel: 'Ваше имя',
    namePlaceholder: 'Как вас зовут?',
    welcomeBack: 'С возвращением:',
    devCodeLabel: 'Тестовый код подтверждения (DEV):',
    devCodeHint: 'Код уже подставлен в поле ниже',
    backBtn: 'Назад',
    signInBtn: 'Войти',
    checking: 'Проверка...',
    invalidPhone: 'Введите корректный номер телефона',
    emptyCode: 'Введите код подтверждения',
    loginSuccess: 'Успешный вход!',
    codeSent: 'Код отправлен!',
    authTabPhone: 'По номеру',
    authTabPassword: 'По паролю',
    authTabDemo: '⚡ Демо-вход',
    resendCodeIn: (sec) => `Повтор через ${sec}с`,
    resendCodeBtn: 'Отправить код повторно',
    passwordLabel: 'Пароль',
    passwordPlaceholder: 'Введите ваш пароль',
    usernameLabel: 'Логин (username)',
    usernamePlaceholder: 'например: alex_dev',
    loginOrEmailLabel: 'Логин, email или телефон',
    loginOrEmailPlaceholder: 'alex_dev, email или телефон',
    loginInputLabel: 'Номер телефона или Email',
    loginInputPlaceholder: '+7 999 123 45 67 или name@mail.com',
    regTitle: 'Создание аккаунта',
    regSubtitle: 'Зарегистрируйтесь для общения в Messenger',
    regTypePhone: 'По телефону',
    regTypeEmail: 'По почте (Email)',
    emailLabel: 'Электронная почта',
    emailPlaceholder: 'name@example.com',
    otpSentTo: (target, ch) =>
      ch === 'email'
        ? `Проверочный код отправлен на почту ${target}`
        : `Проверочный код отправлен на номер ${target}`,
    sendOtpBtn: 'Получить код',
    dontHaveAccount: 'Нету аккаунта? Зарегистрируйтесь',
    alreadyHaveAccount: 'Уже есть аккаунт? Войдите',
    registerBtn: 'Зарегистрироваться',
    quickDemoTitle: 'Быстрый вход для тестирования',
    quickDemoSubtitle: 'Войдите в один клик под готовым тестовым профилем:',

    searchPlaceholder: 'Поиск собеседников...',
    foundUsers: 'Найденные пользователи',
    noChatsTitle: 'Чатов пока нет',
    noChatsHint: 'Найдите пользователя через поиск сверху или создайте группу',
    profileSettings: 'Настройки профиля',
    newChat: 'Создать группу или канал',
    logout: 'Выйти',
    youPrefix: 'Вы:',

    selectChatPlaceholder: 'Выберите чат для начала общения',
    typing: 'печатает...',
    online: 'в сети',
    offlineRecent: 'был(а) недавно',
    offlineJustNow: 'был(а) только что',
    offlineMinutesAgo: (min) => `был(а) ${min} мин. назад`,
    offlineToday: (time) => `был(а) сегодня в ${time}`,
    offlineYesterday: (time) => `был(а) вчера в ${time}`,
    offlineDate: (d, t) => `был(а) ${d} в ${t}`,
    membersCount: (count, online) =>
      online && online > 0
        ? `${count} участников, ${online} в сети`
        : `${count} участников`,
    subscribersCount: (count) => `${count} подписчиков`,
    channelOnlyAdmins: '📢 Публикации в этом канале доступны только администраторам',
    loadingHistory: 'Загрузка сообщений...',
    inputPlaceholder: 'Напишите сообщение...',
    editLabel: 'Редактирование:',
    emojis: 'Эмодзи',
    audioRecording: (sec) => `Запись аудио: ${sec} сек.`,
    cancelBtn: 'Отмена',
    sendBtn: 'Отправить',
    editBtn: 'Изменить',
    deleteBtn: 'Удалить',
    replyBtn: 'Ответить',
    replyTo: 'В ответ',
    photoAttachment: '📷 Фотография',
    fileAttachment: '📎 Файл',
    voiceAttachment: '🎤 Голосовое сообщение',
    audioCall: 'Аудиозвонок',
    videoCall: 'Видеозвонок',
    editedMark: 'ред.',
    today: 'Сегодня',
    yesterday: 'Вчера',
    reactionBtn: 'Реакция',
    pinBtn: 'Закрепить',
    unpinBtn: 'Открепить',
    pinnedMessage: 'Закреплённое сообщение',
    searchInChat: 'Поиск по сообщениям',
    searchPlaceholderChat: 'Поиск в чате...',
    searchNoResults: 'Совпадений нет',
    searchResultsCount: (cur, tot) => `${cur} из ${tot}`,
    download: 'Скачать',
    close: 'Закрыть',

    chatInfo: 'Информация о чате',
    userProfile: 'Информация о пользователе',
    groupInfo: 'Информация о группе',
    channelInfo: 'Информация о канале',
    bio: 'О себе',
    phone: 'Номер телефона',
    username: 'Имя пользователя',
    members: 'Участники',
    subscribers: 'Подписчики',
    addMember: 'Добавить участника',
    searchUsersToAdd: 'Поиск пользователя для добавления...',
    addBtn: 'Добавить',
    removeMember: 'Исключить',
    makeAdmin: 'Назначить администратором',
    dismissAdmin: 'Разжаловать администратора',
    leaveChat: 'Покинуть чат',
    ownerRole: 'Владелец',
    adminRole: 'Администратор',
    memberRole: 'Участник',
    tabMembers: 'Участники',
    tabMedia: 'Медиа',
    tabFiles: 'Файлы',
    tabVoice: 'Голосовые',
    tabLinks: 'Ссылки',
    noSharedMedia: 'Нет общих медиафайлов',
    noSharedFiles: 'Нет общих файлов',
    noSharedVoice: 'Нет голосовых сообщений',
    noSharedLinks: 'Нет ссылок',
    copiedToClipboard: 'Скопировано в буфер обмена',
    copyText: 'Копировать',

    customRoles: 'Кастомные роли',
    createRole: 'Создать роль',
    editRole: 'Редактировать роль',
    deleteRole: 'Удалить роль',
    roleName: 'Название роли',
    roleColor: 'Цвет роли',
    assignRole: 'Назначить роль',
    permissions: 'Права и разрешения',
    permManageRoles: 'Управление ролями и админами',
    permManageMembers: 'Добавление и удаление участников',
    permDeleteMessages: 'Удаление чужих сообщений',
    permPinMessages: 'Закрепление сообщений',
    permChangeInfo: 'Изменение описания и фото',
    permPostMessages: 'Публикация сообщений',
    noRolesYet: 'Кастомных ролей пока нет',
    saveBtn: 'Сохранить',
    roleCreated: 'Роль успешно создана',
    roleUpdated: 'Роль обновлена',
    roleDeleted: 'Роль удалена',

    language: 'Язык',
    soundEffects: 'Звуковые эффекты',
    soundEnabled: 'Звуки сообщений и звонков',
    soundVolume: 'Громкость эффектов',
    testSound: 'Проверить звук',
    soundSent: 'Отправка',
    soundReceived: 'Входящее',

    pushNotifications: 'Push-уведомления',
    pushNotificationsDesc: 'Уведомления на рабочем столе о новых сообщениях',
    pushPermissionGranted: 'Включены',
    pushPermissionDenied: 'Заблокированы в браузере',
    pushPermissionDefault: 'Не настроены',
    enablePushBtn: 'Включить уведомления',
    testPushBtn: 'Тестовый push',
    testPushTitle: 'Тестовое уведомление',
    testPushBody: 'Push-уведомления успешно работают на вашем устройстве!',
  },

  ky: {
    loginTitle: 'Мессенджерге кирүү',
    loginSubtitlePhone: 'Код алуу үчүн телефон номериңизди киргизиңиз',
    loginSubtitleOtp: (phone) => `${phone} номерине жөнөтүлгөн ырастоо кодун киргизиңиз`,
    phoneLabel: 'Телефон номери',
    phonePlaceholder: '+996 555 123 456',
    continueBtn: 'Улантуу',
    sending: 'Жөнөтүлүүдө...',
    otpLabel: 'Ырастоо коду',
    otpPlaceholder: '6 сан',
    nameLabel: 'Сиздин атыңыз',
    namePlaceholder: 'Атыңыз ким?',
    welcomeBack: 'Кайра келишиңиз менен:',
    devCodeLabel: 'Сыноо ырастоо коду (DEV):',
    devCodeHint: 'Код төмөнкү талаага жазылды',
    backBtn: 'Артка',
    signInBtn: 'Кирүү',
    checking: 'Текшерилүүдө...',
    invalidPhone: 'Туура телефон номерин киргизиңиз',
    emptyCode: 'Ырастоо кодун киргизиңиз',
    loginSuccess: 'Ийгиликтүү кирдиңиз!',
    codeSent: 'Код жөнөтүлдү!',
    authTabPhone: 'Номер менен',
    authTabPassword: 'Сырсөз менен',
    authTabDemo: '⚡ Демо кирүү',
    resendCodeIn: (sec) => `Кайра жөнөтүү: ${sec}сек`,
    resendCodeBtn: 'Кодду кайра жөнөтүү',
    passwordLabel: 'Сырсөз',
    passwordPlaceholder: 'Сырсөзүңүздү киргизиңиз',
    usernameLabel: 'Логин (username)',
    usernamePlaceholder: 'мисалы: alex_dev',
    loginOrEmailLabel: 'Логин, email же телефон',
    loginOrEmailPlaceholder: 'alex_dev, email же телефон',
    loginInputLabel: 'Телефон номери же Email',
    loginInputPlaceholder: '+996 555 123 456 же name@mail.com',
    regTitle: 'Аккаунт түзүү',
    regSubtitle: 'Messenger аркылуу баарлашуу үчүн катталыңыз',
    regTypePhone: 'Телефон аркылуу',
    regTypeEmail: 'Почта аркылуу (Email)',
    emailLabel: 'Электрондук почта',
    emailPlaceholder: 'name@example.com',
    otpSentTo: (target, ch) =>
      ch === 'email'
        ? `Ырастоо коду ${target} почтасына жөнөтүлдү`
        : `Ырастоо коду ${target} номерине жөнөтүлдү`,
    sendOtpBtn: 'Кодду алуу',
    dontHaveAccount: 'Аккаунтуңуз жокпу? Катталуу',
    alreadyHaveAccount: 'Аккаунтуңуз барбы? Кирүү',
    registerBtn: 'Катталуу',
    quickDemoTitle: 'Сыноо үчүн тез кирүү',
    quickDemoSubtitle: 'Даяр сыноо профилин тандап бир басуу менен кириңиз:',

    searchPlaceholder: 'Маектештерди издөө...',
    foundUsers: 'Табылган колдонуучулар',
    noChatsTitle: 'Чаттар жок',
    noChatsHint: 'Жогорудагы издөө аркылуу колдонуучу таап же топ түзүңүз',
    profileSettings: 'Профиль жөндөөлөрү',
    newChat: 'Топ же канал түзүү',
    logout: 'Чыгуу',
    youPrefix: 'Сиз:',

    selectChatPlaceholder: 'Баарлашууну баштоо үчүн чат тандаңыз',
    typing: 'жазып жатат...',
    online: 'тармакта',
    offlineRecent: 'жакында эле болгон',
    offlineJustNow: 'жаңы эле болгон',
    offlineMinutesAgo: (min) => `${min} мүнөт мурун болгон`,
    offlineToday: (time) => `бүгүн саат ${time}`,
    offlineYesterday: (time) => `кечээ саат ${time}`,
    offlineDate: (d, t) => `${d} саат ${t}`,
    membersCount: (count, online) =>
      online && online > 0
        ? `${count} катышуучу, ${online} тармакта`
        : `${count} катышуучу`,
    subscribersCount: (count) => `${count} катталуучу`,
    channelOnlyAdmins: '📢 Бул каналда админдер гана жаза алат',
    loadingHistory: 'Кабарлар жүктөлүүдө...',
    inputPlaceholder: 'Кабар жазыңыз...',
    editLabel: 'Түзөтүү:',
    emojis: 'Эмодзи',
    audioRecording: (sec) => `Аудио жазуу: ${sec} сек.`,
    cancelBtn: 'Жокко чыгаруу',
    sendBtn: 'Жөнөтүү',
    editBtn: 'Өзгөртүү',
    deleteBtn: 'Өчүрүү',
    replyBtn: 'Жооп берүү',
    replyTo: 'Жооп иретинде',
    photoAttachment: '📷 Сүрөт',
    fileAttachment: '📎 Файл',
    voiceAttachment: '🎤 Үн кабары',
    audioCall: 'Аудио чалуу',
    videoCall: 'Видео чалуу',
    editedMark: 'өзг.',
    today: 'Бүгүн',
    yesterday: 'Кечээ',
    reactionBtn: 'Реакция',
    pinBtn: 'Бекемдөө',
    unpinBtn: 'Бекемдөөнү алып салуу',
    pinnedMessage: 'Бекемделген билдирүү',
    searchInChat: 'Билдирүүлөрдөн издөө',
    searchPlaceholderChat: 'Чатта издөө...',
    searchNoResults: 'Эч нерсе табылган жок',
    searchResultsCount: (cur, tot) => `${cur} / ${tot}`,
    download: 'Жүктөп алуу',
    close: 'Жабуу',

    chatInfo: 'Чат жөнүндө маалымат',
    userProfile: 'Колдонуучу жөнүндө маалымат',
    groupInfo: 'Топ жөнүндө маалымат',
    channelInfo: 'Канал жөнүндө маалымат',
    bio: 'Өзү жөнүндө',
    phone: 'Телефон номери',
    username: 'Колдонуучунун аты',
    members: 'Катышуучулар',
    subscribers: 'Катталуучулар',
    addMember: 'Катышуучу кошуу',
    searchUsersToAdd: 'Кошуу үчүн колдонуучу издөө...',
    addBtn: 'Кошуу',
    removeMember: 'Чыгаруу',
    makeAdmin: 'Администратор кылуу',
    dismissAdmin: 'Администраторду бошотуу',
    leaveChat: 'Чаттан чыгуу',
    ownerRole: 'Ээси',
    adminRole: 'Администратор',
    memberRole: 'Катышуучу',
    tabMembers: 'Катышуучулар',
    tabMedia: 'Медиа',
    tabFiles: 'Файлдар',
    tabVoice: 'Үн кабарлар',
    tabLinks: 'Шилтемелер',
    noSharedMedia: 'Жалпы медиа жок',
    noSharedFiles: 'Жалпы файлдар жок',
    noSharedVoice: 'Үн кабарлар жок',
    noSharedLinks: 'Шилтемелер жок',
    copiedToClipboard: 'Алмашуу буферине көчүрүлдү',
    copyText: 'Көчүрүү',

    customRoles: 'Ыңгайлаштырылган ролдор',
    createRole: 'Роль түзүү',
    editRole: 'Ролду оңдоо',
    deleteRole: 'Ролду өчүрүү',
    roleName: 'Ролдун аталышы',
    roleColor: 'Ролдун түсү',
    assignRole: 'Роль дайындоо',
    permissions: 'Укуктар жана уруксаттар',
    permManageRoles: 'Ролдорду жана админдерди башкаруу',
    permManageMembers: 'Катышуучуларды кошуу жана чыгаруу',
    permDeleteMessages: 'Башкалардын билдирүүлөрүн өчүрүү',
    permPinMessages: 'Билдирүүлөрдү бекемдөө',
    permChangeInfo: 'Чаттын сүрөтүн жана маалыматын өзгөртүү',
    permPostMessages: 'Билдирүүлөрдү жарыялоо',
    noRolesYet: 'Ыңгайлаштырылган ролдор жок',
    saveBtn: 'Сактоо',
    roleCreated: 'Роль ийгиликтүү түзүлдү',
    roleUpdated: 'Роль жаңыртылды',
    roleDeleted: 'Роль өчүрүлдү',

    language: 'Тил',
    soundEffects: 'Үн эффекттери',
    soundEnabled: 'Билдирүү жана чалуу үндөрү',
    soundVolume: 'Үндүн катуулугу',
    testSound: 'Үндү сыноо',
    soundSent: 'Жөнөтүү',
    soundReceived: 'Кирүүчү',

    pushNotifications: 'Push-билдирүүлөр',
    pushNotificationsDesc: 'Жаңы билдирүүлөр тууралуу жумушчу столдогу билдирүүлөр',
    pushPermissionGranted: 'Күйгүзүлдү',
    pushPermissionDenied: 'Браузерде бөгөттөлгөн',
    pushPermissionDefault: 'Күйгүзүлгөн эмес',
    enablePushBtn: 'Билдирүүлөрдү күйгүзүү',
    testPushBtn: 'Сыноо push',
    testPushTitle: 'Сыноо билдирүүсү',
    testPushBody: 'Push-билдирүүлөр сиздин түзмөгүңүздө ийгиликтүү иштеп жатат!',
  },

  en: {
    loginTitle: 'Sign in to Messenger',
    loginSubtitlePhone: 'Enter your phone number to receive a code',
    loginSubtitleOtp: (phone) => `Enter the verification code sent to ${phone}`,
    phoneLabel: 'Phone number',
    phonePlaceholder: '+1 555 123 4567',
    continueBtn: 'Continue',
    sending: 'Sending...',
    otpLabel: 'Verification code',
    otpPlaceholder: '6 digits',
    nameLabel: 'Your name',
    namePlaceholder: "What's your name?",
    welcomeBack: 'Welcome back:',
    devCodeLabel: 'Test verification code (DEV):',
    devCodeHint: 'Code is already entered in the field below',
    backBtn: 'Back',
    signInBtn: 'Sign In',
    checking: 'Checking...',
    invalidPhone: 'Please enter a valid phone number',
    emptyCode: 'Please enter the verification code',
    loginSuccess: 'Successfully signed in!',
    codeSent: 'Code sent!',
    authTabPhone: 'By Phone',
    authTabPassword: 'Password',
    authTabDemo: '⚡ Demo Login',
    resendCodeIn: (sec) => `Resend in ${sec}s`,
    resendCodeBtn: 'Resend code',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    usernameLabel: 'Username',
    usernamePlaceholder: 'e.g. alex_dev',
    loginOrEmailLabel: 'Username, email or phone',
    loginOrEmailPlaceholder: 'alex_dev, email or phone',
    loginInputLabel: 'Phone number or Email',
    loginInputPlaceholder: '+1 555 123 4567 or user@mail.com',
    regTitle: 'Create an Account',
    regSubtitle: 'Sign up to start messaging on Messenger',
    regTypePhone: 'By Phone',
    regTypeEmail: 'By Email',
    emailLabel: 'Email address',
    emailPlaceholder: 'name@example.com',
    otpSentTo: (target, ch) =>
      ch === 'email'
        ? `Verification code sent to email ${target}`
        : `Verification code sent to phone ${target}`,
    sendOtpBtn: 'Get Code',
    dontHaveAccount: "Don't have an account? Sign up",
    alreadyHaveAccount: 'Already have an account? Sign in',
    registerBtn: 'Create account',
    quickDemoTitle: 'Quick Demo Access',
    quickDemoSubtitle: 'Sign in instantly with a preconfigured demo account:',

    searchPlaceholder: 'Search conversations...',
    foundUsers: 'Found users',
    noChatsTitle: 'No chats yet',
    noChatsHint: 'Find users using the search above or create a group',
    profileSettings: 'Profile settings',
    newChat: 'New group or channel',
    logout: 'Log out',
    youPrefix: 'You:',

    selectChatPlaceholder: 'Select a chat to start messaging',
    typing: 'typing...',
    online: 'online',
    offlineRecent: 'last seen recently',
    offlineJustNow: 'last seen just now',
    offlineMinutesAgo: (min) => `last seen ${min}m ago`,
    offlineToday: (time) => `last seen today at ${time}`,
    offlineYesterday: (time) => `last seen yesterday at ${time}`,
    offlineDate: (d, t) => `last seen ${d} at ${t}`,
    membersCount: (count, online) =>
      online && online > 0
        ? `${count} members, ${online} online`
        : `${count} members`,
    subscribersCount: (count) => `${count} subscribers`,
    channelOnlyAdmins: '📢 Only administrators can post in this channel',
    loadingHistory: 'Loading messages...',
    inputPlaceholder: 'Write a message...',
    editLabel: 'Editing:',
    emojis: 'Emoji',
    audioRecording: (sec) => `Recording audio: ${sec}s`,
    cancelBtn: 'Cancel',
    sendBtn: 'Send',
    editBtn: 'Edit',
    deleteBtn: 'Delete',
    replyBtn: 'Reply',
    replyTo: 'Replying to',
    photoAttachment: '📷 Photo',
    fileAttachment: '📎 File',
    voiceAttachment: '🎤 Voice message',
    audioCall: 'Audio call',
    videoCall: 'Video call',
    editedMark: 'edited',
    today: 'Today',
    yesterday: 'Yesterday',
    reactionBtn: 'Reaction',
    pinBtn: 'Pin',
    unpinBtn: 'Unpin',
    pinnedMessage: 'Pinned Message',
    searchInChat: 'Search in chat',
    searchPlaceholderChat: 'Search in chat...',
    searchNoResults: 'No matches found',
    searchResultsCount: (cur, tot) => `${cur} of ${tot}`,
    download: 'Download',
    close: 'Close',

    chatInfo: 'Chat Info',
    userProfile: 'User Info',
    groupInfo: 'Group Info',
    channelInfo: 'Channel Info',
    bio: 'Bio',
    phone: 'Phone number',
    username: 'Username',
    members: 'Members',
    subscribers: 'Subscribers',
    addMember: 'Add Member',
    searchUsersToAdd: 'Search user to add...',
    addBtn: 'Add',
    removeMember: 'Remove',
    makeAdmin: 'Promote to Admin',
    dismissAdmin: 'Dismiss Admin',
    leaveChat: 'Leave Chat',
    ownerRole: 'Owner',
    adminRole: 'Admin',
    memberRole: 'Member',
    tabMembers: 'Members',
    tabMedia: 'Media',
    tabFiles: 'Files',
    tabVoice: 'Voice',
    tabLinks: 'Links',
    noSharedMedia: 'No shared media',
    noSharedFiles: 'No shared files',
    noSharedVoice: 'No voice messages',
    noSharedLinks: 'No links shared',
    copiedToClipboard: 'Copied to clipboard',
    copyText: 'Copy',

    customRoles: 'Custom Roles',
    createRole: 'Create Role',
    editRole: 'Edit Role',
    deleteRole: 'Delete Role',
    roleName: 'Role Name',
    roleColor: 'Role Color',
    assignRole: 'Assign Role',
    permissions: 'Permissions',
    permManageRoles: 'Manage roles and admins',
    permManageMembers: 'Add and remove members',
    permDeleteMessages: 'Delete others messages',
    permPinMessages: 'Pin messages',
    permChangeInfo: 'Change chat info and photo',
    permPostMessages: 'Post messages',
    noRolesYet: 'No custom roles yet',
    saveBtn: 'Save',
    roleCreated: 'Role created successfully',
    roleUpdated: 'Role updated successfully',
    roleDeleted: 'Role deleted',

    language: 'Language',
    soundEffects: 'Sound Effects',
    soundEnabled: 'Message and call sounds',
    soundVolume: 'Sound volume',
    testSound: 'Test sound',
    soundSent: 'Sent',
    soundReceived: 'Received',

    pushNotifications: 'Push Notifications',
    pushNotificationsDesc: 'Desktop notifications for new incoming messages',
    pushPermissionGranted: 'Enabled',
    pushPermissionDenied: 'Blocked in browser',
    pushPermissionDefault: 'Not configured',
    enablePushBtn: 'Enable Notifications',
    testPushBtn: 'Test Push',
    testPushTitle: 'Test Notification',
    testPushBody: 'Push notifications are working properly on your device!',
  },
};
