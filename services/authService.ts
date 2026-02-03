import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  onAuthStateChanged
} from "firebase/auth";
import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  updateDoc, 
  deleteDoc 
} from "firebase/firestore";
import { auth, db } from "./firebaseConfig";
import { User } from "../types";

// --- Funções de Autenticação ---

export const register = async (name: string, email: string, password: string): Promise<User> => {
  try {
    // 1. Cria o Login no Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Lógica de Admin Hardcoded
    const isAdmin = email === 'admin@parnaso.com';
    const role = isAdmin ? 'admin' : 'user';
    // Se for admin, já nasce ativo. Se for user comum, nasce bloqueado (pending).
    const isBlocked = !isAdmin;

    const newUser: User = {
      id: firebaseUser.uid,
      name,
      email,
      role,
      isBlocked
    };

    // 2. Salva no Firestore (Banco de Dados)
    await setDoc(doc(db, "users", firebaseUser.uid), newUser);

    // Se nasceu bloqueado, desloga para impedir acesso imediato
    if (isBlocked) {
      await signOut(auth);
    }

    return newUser;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('E-mail já cadastrado.');
    }
    throw error;
  }
};

export const login = async (email: string, password: string): Promise<User> => {
  try {
    // 1. Autentica
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // 2. Busca dados no Firestore
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      // Caso raro: usuário existe no Auth mas sem ficha no banco
      throw new Error("Usuário sem registro no banco de dados.");
    }

    const userData = userDoc.data() as User;

    // 3. Verifica bloqueio
    if (userData.isBlocked) {
      await signOut(auth);
      throw new Error('Conta pendente de aprovação. Aguarde o administrador.');
    }

    return userData;
  } catch (error: any) {
    // Tratamento de erros comuns do Firebase
    if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      throw new Error('E-mail ou senha inválidos.');
    }
    throw error;
  }
};

export const logout = async () => {
  await signOut(auth);
};

export const getCurrentUser = async (): Promise<User | null> => {
  // Promessa para esperar o Firebase verificar se tem alguém logado
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          resolve(userDoc.data() as User);
        } else {
          resolve(null);
        }
      } else {
        resolve(null);
      }
      unsubscribe(); // Limpa o listener
    });
  });
};

export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw new Error('Erro ao enviar email de recuperação.');
  }
};

// --- Funções de Admin ---

export const getAllUsers = async (): Promise<User[]> => {
  const querySnapshot = await getDocs(collection(db, "users"));
  const users: User[] = [];
  querySnapshot.forEach((doc) => {
    users.push(doc.data() as User);
  });
  return users;
};

export const toggleUserBlock = async (userId: string): Promise<void> => {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    const userData = userSnap.data() as User;
    
    if (userData.role === 'admin') return; // Não bloqueia admin

    await updateDoc(userRef, {
      isBlocked: !userData.isBlocked
    });
  }
};

export const deleteUser = async (userId: string): Promise<void> => {
  await deleteDoc(doc(db, "users", userId));
};
