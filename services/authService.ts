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
  deleteDoc,
  query,
  where
} from "firebase/firestore";
import { auth, db } from "./firebaseConfig";
import { User } from "../types";

const ADMIN_EMAIL = 'admin@parnaso.com';

// --- Funções Auxiliares ---

export const checkUserExists = async (email: string): Promise<boolean> => {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Erro ao verificar usuário:", error);
    return false;
  }
};

// --- Funções de Autenticação ---

export const register = async (name: string, email: string, password: string): Promise<User> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    const isAdmin = email === ADMIN_EMAIL;
    
    // Regra de Ouro: Se NÃO for admin, nasce BLOQUEADO.
    const role = isAdmin ? 'admin' : 'user';
    const isBlocked = !isAdmin; 

    const newUser: User = {
      id: firebaseUser.uid,
      name,
      email,
      role,
      isBlocked
    };

    await setDoc(doc(db, "users", firebaseUser.uid), newUser);

    if (isBlocked) {
      await signOut(auth);
      // O erro abaixo é intencional para avisar a interface
      throw new Error('Cadastro realizado! Aguarde a aprovação do administrador.');
    }

    return newUser;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('E-mail já cadastrado.');
    }
    // Repassa o erro de bloqueio para o front-end mostrar o aviso
    throw error;
  }
};

export const login = async (email: string, password: string): Promise<User> => {
  try {
    // 1. Tenta logar no Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // 2. Busca o documento no Banco de Dados
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);

    // --- CORREÇÃO DE SEGURANÇA E ADMIN ---
    
    // Se for o CHEFE, nós garantimos o acesso agora (Auto-Correção)
    if (email === ADMIN_EMAIL) {
      const adminData: User = {
        id: uid,
        name: 'Administrador',
        email: email,
        role: 'admin',
        isBlocked: false
      };
      
      // Força a gravação dos dados de Admin no banco (sobrescreve se estiver errado)
      await setDoc(userDocRef, adminData, { merge: true });
      return adminData;
    }

    // Se NÃO for o chefe e não tiver documento no banco: ERRO.
    // (Isso impede que "qualquer coisa entre")
    if (!userDoc.exists()) {
      await signOut(auth);
      throw new Error("Erro de integridade: Usuário sem registro no banco de dados.");
    }

    // 3. Verifica Bloqueio
    const userData = userDoc.data() as User;

    if (userData.isBlocked) {
      await signOut(auth);
      throw new Error('Conta pendente de aprovação. Aguarde o administrador.');
    }

    // Se passou por tudo, retorna o usuário limpo
    return userData;

  } catch (error: any) {
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
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Se for o admin, já retorna os dados forçados para evitar delay do banco
        if (firebaseUser.email === ADMIN_EMAIL) {
           resolve({
             id: firebaseUser.uid,
             name: 'Administrador',
             email: firebaseUser.email!,
             role: 'admin',
             isBlocked: false
           });
           return;
        }

        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          resolve(userDoc.data() as User);
        } else {
          resolve(null);
        }
      } else {
        resolve(null);
      }
      unsubscribe();
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
    // Proteção: Não pode bloquear o admin supremo
    if (userData.email === ADMIN_EMAIL) return;

    await updateDoc(userRef, {
      isBlocked: !userData.isBlocked
    });
  }
};

export const deleteUser = async (userId: string): Promise<void> => {
  // Proteção extra: verificar se não é o admin antes de deletar
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
     const data = userSnap.data() as User;
     if (data.email === ADMIN_EMAIL) throw new Error("Não é possível deletar o administrador principal.");
  }
  await deleteDoc(userRef);
};
