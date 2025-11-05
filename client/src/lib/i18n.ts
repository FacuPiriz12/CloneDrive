import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Traducciones inline como fallback
const resources = {
  es: {
    common: {
      app: {
        title: "TERA",
        description: "Gestión de archivos de Google Drive"
      },
      navigation: {
        home: "Inicio",
        files: "Archivos", 
        operations: "Operaciones",
        myFiles: "Mis Archivos",
        sharedDrives: "Drives Compartidos",
        analytics: "Analíticas",
        settings: "Configuración",
        profile: "Perfil",
        copyFromUrl: "Copiar desde URL",
        integrations: "Integraciones"
      },
      language: {
        select: "Seleccionar idioma",
        spanish: "Español",
        english: "English"
      },
      auth: {
        login: "Iniciar Sesión",
        logout: "Cerrar Sesión",
        loggingOut: "Cerrando sesión..."
      },
      actions: {
        new: "Nuevo",
        search: "Buscar",
        searchPlaceholder: "Buscar en tus archivos...",
        upload: "Subir",
        download: "Descargar",
        copy: "Copiar",
        delete: "Eliminar",
        edit: "Editar",
        view: "Ver"
      },
      user: {
        fallbackName: "Usuario",
        myAccount: "Mi Cuenta",
        profile: "Perfil",
        settings: "Configuración"
      },
      buttons: {
        cancel: "Cancelar",
        confirm: "Confirmar",
        save: "Guardar",
        close: "Cerrar",
        retry: "Reintentar",
        back: "Volver",
        next: "Siguiente",
        change: "Cambiar",
        select: "Seleccionar"
      },
      status: {
        loading: "Cargando...",
        success: "Éxito",
        error: "Error",
        completed: "Completado",
        pending: "Pendiente",
        inProgress: "En progreso"
      },
      footer: {
        copyright: "© 2025 TERA. Todos los derechos reservados."
      },
      sidebar: {
        recentActivity: "Actividad Reciente",
        storage: "Almacenamiento",
        storageUsed: "{{used}} de {{total}} usado",
        copyingFiles: "Copiando archivos...",
        filesProgress: "{{completed}} de {{total}} archivos",
        operationCompleted: "Operación completada",
        noRecentActivity: "No hay actividad reciente"
      },
      dashboard: {
        totalFiles: "Total de Archivos",
        activeOperations: "Operaciones Activas", 
        totalOperations: "Total Operaciones",
        completedOperations: "Completadas",
        filesManaged: "Archivos gestionados",
        inProgress: "En progreso", 
        successfully: "Exitosamente",
        operationsPerformed: "Operaciones realizadas",
        recentFiles: "Archivos Recientes",
        noAccountConnected: "Ninguna cuenta ha sido conectada. Por favor, conecte una cuenta en",
        integrations: "Integraciones",
        toStartWorking: "para comenzar a trabajar."
      }
    },
    copy: {
      quickCopy: {
        title: "Copia Rápida",
        urlLabel: "URL Compartida",
        urlPlaceholder: "Ingresa una URL de Google Drive o Dropbox",
        destinationLabel: "Carpeta de destino",
        includeSubfolders: "Incluir subcarpetas",
        preview: "Ver Vista Previa",
        starting: "Iniciando..."
      },
      preview: {
        title: "Vista Previa de Copia",
        analyzing: "Analizando archivos y carpetas...",
        destination: "Destino de copia",
        destinationMessage: "Los archivos se copiarán a esta carpeta",
        confirmCopy: "Confirmar y Copiar",
        initiating: "Iniciando copia..."
      },
      folderBrowser: {
        title: "Seleccionar Carpeta de Destino",
        loading: "Cargando carpetas...",
        noFolders: "No hay subcarpetas en esta ubicación",
        selectCurrent: "Seleccionar esta carpeta",
        goBack: "Volver",
        myDrive: "Mi Drive"
      },
      operations: {
        started: "Copia iniciada",
        startedMessage: "La operación de copia ha comenzado. Puedes ver el progreso en la barra lateral."
      }
    },
    pages: {
      myFiles: {
        title: "Mis Archivos",
        description: "Archivos y carpetas copiados desde Google Drive",
        searchPlaceholder: "Buscar archivos...",
        noFilesFound: "No se encontraron archivos",
        noFilesCopied: "No hay archivos copiados", 
        tryDifferentSearch: "Intenta con otro término de búsqueda",
        filesWillAppearHere: "Los archivos que copies desde Google Drive aparecerán aquí",
        copied: "Copiado",
        showing: "Mostrando",
        to: "a",
        of: "de",
        files: "archivos",
        previous: "Anterior",
        next: "Siguiente"
      },
      operations: {
        title: "Operaciones",
        description: "Historial completo de todas las operaciones de copia realizadas",
        noOperations: "No hay operaciones registradas",
        operationsWillAppear: "Cuando realices copias de archivos, aparecerán aquí con todos los detalles",
        copyOperation: "Operación de Copia",
        date: "Fecha",
        duration: "Duración",
        state: "Estado",
        successful: "Exitoso",
        inProgress: "En curso",
        error: "Error",
        pending: "Pendiente",
        sourceUrl: "URL de origen:",
        copyCompletedSuccessfully: "Copia completada exitosamente",
        copiedFile: "Archivo copiado:",
        linkToCopiedFolder: "Enlace a la carpeta copiada en tu Drive:",
        openInGoogleDrive: "Abrir en Google Drive"
      },
      notFound: {
        title: "404 Página No Encontrada",
        description: "¿Olvidaste agregar la página al router?"
      },
      analytics: {
        title: "Análisis",
        description: "Estadísticas detalladas de tus operaciones de copia",
        totalOperations: "Total Operaciones",
        filesCopied: "Archivos Copiados",
        successRate: "Tasa de Éxito",
        averageTime: "Tiempo Promedio",
        inProgress: "en progreso",
        totalFilesProcessed: "Total de archivos procesados",
        perCompletedOperation: "Por operación completada",
        operationStatus: "Estado de Operaciones",
        completed: "Completadas",
        failed: "Fallidas",
        inProgressStatus: "En Progreso",
        activityLast7Days: "Actividad Últimos 7 Días",
        noDataTitle: "No hay datos para analizar",
        noDataMessage: "Realiza algunas operaciones de copia para ver estadísticas detalladas aquí"
      }
    },
    landing: {
      hero: {
        title: "Copia archivos de Google Drive",
        subtitle: "de forma inteligente",
        description: "TERA te permite copiar archivos y carpetas desde drives compartidos a tu Google Drive personal con solo pegar una URL. Simple, rápido y seguro.",
        ctaButton: "Comenzar Ahora"
      },
      features: {
        title: "¿Por qué elegir TERA?",
        subtitle: "Diseñado para hacer que copiar archivos de Google Drive sea tan simple como pegar una URL",
        smartCopy: {
          title: "Copia Inteligente",
          description: "Copia archivos y carpetas completas manteniendo la estructura original"
        },
        driveCompatible: {
          title: "Compatible con Drive",
          description: "Funciona con cualquier enlace público o privado de Google Drive"
        },
        fast: {
          title: "Súper Rápido",
          description: "Copia directa servidor a servidor sin descargar archivos localmente"
        },
        secure: {
          title: "100% Seguro",
          description: "Usa la autenticación oficial de Google. Tus datos siempre protegidos"
        }
      },
      howItWorks: {
        title: "Cómo funciona",
        subtitle: "En solo 3 simples pasos tendrás tus archivos copiados",
        step1: {
          title: "Pega la URL",
          description: "Copia la URL del archivo o carpeta de Google Drive que quieres clonar"
        },
        step2: {
          title: "Elige destino",
          description: "Selecciona dónde quieres guardar los archivos en tu Google Drive"
        },
        step3: {
          title: "¡Listo!",
          description: "Los archivos se copian automáticamente. Puedes ver el progreso en tiempo real"
        }
      },
      cta: {
        title: "¿Listo para comenzar?",
        subtitle: "Únete a miles de usuarios que ya están copiando archivos de forma inteligente",
        button: "Iniciar Sesión con Google"
      },
      footer: {
        tagline: "Gestor de Archivos Inteligente - Hecho con ❤️ para la comunidad"
      }
    },
    errors: {
      validation: {
        urlRequired: "URL requerida",
        invalidUrl: "Por favor ingresa una URL válida de Google Drive",
        invalidEmail: "Por favor ingresa un email válido",
        passwordTooShort: "La contraseña debe tener al menos 6 caracteres",
        nameRequired: "El nombre es requerido",
        acceptTermsRequired: "Debes aceptar los términos y condiciones",
        passwordsDoNotMatch: "Las contraseñas no coinciden"
      }
    },
    auth: {
      login: {
        title: "Iniciar Sesión",
        subtitle: "Accede a tu cuenta de TERA",
        continueWithReplit: "Continuar con Replit",
        orContinueWith: "o continúa con",
        emailLabel: "Correo electrónico",
        emailPlaceholder: "tu@email.com",
        passwordLabel: "Contraseña",
        passwordPlaceholder: "Tu contraseña",
        signInButton: "Iniciar Sesión",
        forgotPassword: "¿Olvidaste tu contraseña?",
        noAccount: "¿No tienes una cuenta?",
        signUp: "Regístrate"
      },
      signup: {
        title: "Crear Cuenta",
        subtitle: "Únete a TERA y comienza a gestionar tus archivos",
        continueWithReplit: "Registrarse con Replit",
        orCreateAccountWith: "o crear cuenta con",
        nameLabel: "Nombre completo",
        namePlaceholder: "Tu nombre completo",
        emailLabel: "Correo electrónico",
        emailPlaceholder: "tu@email.com",
        passwordLabel: "Contraseña",
        passwordPlaceholder: "Mínimo 6 caracteres",
        confirmPasswordLabel: "Confirmar contraseña",
        confirmPasswordPlaceholder: "Confirma tu contraseña",
        acceptTerms: {
          part1: "Acepto los",
          termsLink: "términos de servicio",
          and: "y",
          privacyLink: "política de privacidad"
        },
        createAccountButton: "Crear Cuenta",
        hasAccount: "¿Ya tienes una cuenta?",
        signIn: "Inicia sesión"
      },
      validation: {
        invalidEmail: "Por favor ingresa un email válido",
        passwordTooShort: "La contraseña debe tener al menos 6 caracteres",
        nameRequired: "El nombre es requerido",
        acceptTermsRequired: "Debes aceptar los términos y condiciones",
        passwordsDoNotMatch: "Las contraseñas no coinciden"
      }
    }
  },
  en: {
    common: {
      app: {
        title: "TERA",
        description: "Google Drive file management"
      },
      navigation: {
        home: "Home",
        files: "Files", 
        operations: "Operations",
        myFiles: "My Files",
        sharedDrives: "Shared Drives",
        analytics: "Analytics",
        settings: "Settings",
        profile: "Profile",
        copyFromUrl: "Copy from URL",
        integrations: "Integrations"
      },
      language: {
        select: "Select language",
        spanish: "Español",
        english: "English"
      },
      auth: {
        login: "Log In",
        logout: "Log Out",
        loggingOut: "Logging out..."
      },
      actions: {
        new: "New",
        search: "Search",
        searchPlaceholder: "Search your files...",
        upload: "Upload",
        download: "Download",
        copy: "Copy",
        delete: "Delete",
        edit: "Edit",
        view: "View"
      },
      user: {
        fallbackName: "User",
        myAccount: "My Account",
        profile: "Profile",
        settings: "Settings"
      },
      buttons: {
        cancel: "Cancel",
        confirm: "Confirm",
        save: "Save",
        close: "Close",
        retry: "Retry",
        back: "Back",
        next: "Next",
        change: "Change",
        select: "Select"
      },
      status: {
        loading: "Loading...",
        success: "Success",
        error: "Error",
        completed: "Completed",
        pending: "Pending",
        inProgress: "In progress"
      },
      footer: {
        copyright: "© 2025 TERA. All rights reserved."
      },
      sidebar: {
        recentActivity: "Recent Activity",
        storage: "Storage",
        storageUsed: "{{used}} of {{total}} used",
        copyingFiles: "Copying files...",
        filesProgress: "{{completed}} of {{total}} files",
        operationCompleted: "Operation completed",
        noRecentActivity: "No recent activity"
      },
      dashboard: {
        totalFiles: "Total Files",
        activeOperations: "Active Operations", 
        totalOperations: "Total Operations",
        completedOperations: "Completed",
        filesManaged: "Files managed",
        inProgress: "In progress", 
        successfully: "Successfully",
        operationsPerformed: "Operations performed",
        recentFiles: "Recent Files",
        noAccountConnected: "No account has been connected. Please connect an account in",
        integrations: "Integrations",
        toStartWorking: "to start working."
      }
    },
    copy: {
      quickCopy: {
        title: "Quick Copy",
        urlLabel: "Shared URL",
        urlPlaceholder: "Enter a URL from Google Drive or Dropbox",
        destinationLabel: "Destination folder",
        includeSubfolders: "Include subfolders",
        preview: "Preview",
        starting: "Starting..."
      },
      preview: {
        title: "Copy Preview",
        analyzing: "Analyzing files and folders...",
        destination: "Copy destination",
        destinationMessage: "Files will be copied to this folder",
        confirmCopy: "Confirm and Copy",
        initiating: "Starting copy..."
      },
      folderBrowser: {
        title: "Select Destination Folder",
        loading: "Loading folders...",
        noFolders: "No subfolders in this location", 
        selectCurrent: "Select this folder",
        goBack: "Go back",
        myDrive: "My Drive"
      },
      operations: {
        started: "Copy started",
        startedMessage: "The copy operation has started. You can see the progress in the sidebar."
      }
    },
    pages: {
      myFiles: {
        title: "My Files",
        description: "Files and folders copied from Google Drive",
        searchPlaceholder: "Search files...",
        noFilesFound: "No files found",
        noFilesCopied: "No files copied", 
        tryDifferentSearch: "Try a different search term",
        filesWillAppearHere: "Files you copy from Google Drive will appear here",
        copied: "Copied",
        showing: "Showing",
        to: "to",
        of: "of",
        files: "files",
        previous: "Previous",
        next: "Next"
      },
      operations: {
        title: "Operations",
        description: "Complete history of all copy operations performed",
        noOperations: "No operations recorded",
        operationsWillAppear: "When you perform file copies, they will appear here with all the details",
        copyOperation: "Copy Operation",
        date: "Date",
        duration: "Duration",
        state: "State",
        successful: "Successful",
        inProgress: "In progress",
        error: "Error",
        pending: "Pending",
        sourceUrl: "Source URL:",
        copyCompletedSuccessfully: "Copy completed successfully",
        copiedFile: "Copied file:",
        linkToCopiedFolder: "Link to copied folder in your Drive:",
        openInGoogleDrive: "Open in Google Drive"
      },
      notFound: {
        title: "404 Page Not Found",
        description: "Did you forget to add the page to the router?"
      },
      analytics: {
        title: "Analytics",
        description: "Detailed statistics of your copy operations",
        totalOperations: "Total Operations",
        filesCopied: "Files Copied",
        successRate: "Success Rate",
        averageTime: "Average Time",
        inProgress: "in progress",
        totalFilesProcessed: "Total files processed",
        perCompletedOperation: "Per completed operation",
        operationStatus: "Operation Status",
        completed: "Completed",
        failed: "Failed",
        inProgressStatus: "In Progress",
        activityLast7Days: "Activity Last 7 Days",
        noDataTitle: "No data to analyze",
        noDataMessage: "Perform some copy operations to see detailed statistics here"
      }
    },
    landing: {
      hero: {
        title: "Copy Google Drive files",
        subtitle: "intelligently",
        description: "TERA allows you to copy files and folders from shared drives to your personal Google Drive by just pasting a URL. Simple, fast and secure.",
        ctaButton: "Get Started"
      },
      features: {
        title: "Why choose TERA?",
        subtitle: "Designed to make copying Google Drive files as simple as pasting a URL",
        smartCopy: {
          title: "Smart Copy",
          description: "Copy complete files and folders while maintaining the original structure"
        },
        driveCompatible: {
          title: "Drive Compatible",
          description: "Works with any public or private Google Drive link"
        },
        fast: {
          title: "Super Fast",
          description: "Direct server-to-server copy without downloading files locally"
        },
        secure: {
          title: "100% Secure",
          description: "Uses official Google authentication. Your data always protected"
        }
      },
      howItWorks: {
        title: "How it works",
        subtitle: "In just 3 simple steps you'll have your files copied",
        step1: {
          title: "Paste the URL",
          description: "Copy the URL of the Google Drive file or folder you want to clone"
        },
        step2: {
          title: "Choose destination",
          description: "Select where you want to save the files in your Google Drive"
        },
        step3: {
          title: "Done!",
          description: "Files are copied automatically. You can see the progress in real-time"
        }
      },
      cta: {
        title: "Ready to get started?",
        subtitle: "Join thousands of users who are already copying files intelligently",
        button: "Sign In with Google"
      },
      footer: {
        tagline: "Smart File Manager - Made with ❤️ for the community"
      }
    },
    errors: {
      validation: {
        urlRequired: "URL required",
        invalidUrl: "Please enter a valid Google Drive URL",
        invalidEmail: "Please enter a valid email",
        passwordTooShort: "Password must be at least 6 characters",
        nameRequired: "Name is required",
        acceptTermsRequired: "You must accept the terms and conditions",
        passwordsDoNotMatch: "Passwords do not match"
      }
    },
    auth: {
      login: {
        title: "Sign In",
        subtitle: "Access your TERA account",
        continueWithReplit: "Continue with Replit",
        orContinueWith: "or continue with",
        emailLabel: "Email address",
        emailPlaceholder: "your@email.com",
        passwordLabel: "Password",
        passwordPlaceholder: "Your password",
        signInButton: "Sign In",
        forgotPassword: "Forgot your password?",
        noAccount: "Don't have an account?",
        signUp: "Sign up"
      },
      signup: {
        title: "Create Account",
        subtitle: "Join TERA and start managing your files",
        continueWithReplit: "Sign up with Replit",
        orCreateAccountWith: "or create account with",
        nameLabel: "Full name",
        namePlaceholder: "Your full name",
        emailLabel: "Email address",
        emailPlaceholder: "your@email.com",
        passwordLabel: "Password",
        passwordPlaceholder: "At least 6 characters",
        confirmPasswordLabel: "Confirm password",
        confirmPasswordPlaceholder: "Confirm your password",
        acceptTerms: {
          part1: "I accept the",
          termsLink: "terms of service",
          and: "and",
          privacyLink: "privacy policy"
        },
        createAccountButton: "Create Account",
        hasAccount: "Already have an account?",
        signIn: "Sign in"
      },
      validation: {
        invalidEmail: "Please enter a valid email",
        passwordTooShort: "Password must be at least 6 characters",
        nameRequired: "Name is required",
        acceptTermsRequired: "You must accept the terms and conditions",
        passwordsDoNotMatch: "Passwords do not match"
      }
    }
  }
};

// Evitar inicialización duplicada durante HMR
if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      // Configuración de detección de idioma
      detection: {
        order: ['localStorage', 'navigator', 'htmlTag'],
        caches: ['localStorage'],
        lookupLocalStorage: 'i18nextLng',
      },
      
      resources,
      fallbackLng: 'es', // Español por defecto
      debug: import.meta.env.DEV,
      
      // Idiomas soportados
      supportedLngs: ['es', 'en'],
      
      // Espacios de nombres
      ns: ['common', 'copy', 'errors', 'landing', 'pages'],
      defaultNS: 'common',
      
      interpolation: {
        escapeValue: false, // React ya escapa los valores
      },
      
      // Opciones específicas de React
      react: {
        useSuspense: false, // Desactivar suspense para mejor control
      },
    });
}

export default i18n;