import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updatePassword 
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
import { auth, db } from "./firebaseConfig"; // Importa a config que criamos
import { User } from "../types";

// --- Funções de Autenticação ---

export const register = async (name: string, email: string, password: string): Promise<User> => {
  try {
    // 1. Cria o Login no Firebase Auth (Email/Senha)
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Lógica de Admin Hardcoded (mantida do seu código original)
    const isAdmin = email === 'admin@parnaso.com';
    const role = isAdmin ? 'admin' : 'user';
    const isBlocked = !isAdmin; // Todos nascem bloqueados, exceto admin

    const newUser: User = {
      id: firebaseUser.uid, // O ID agora vem do Firebase
      name,
      email,
      role,
      isBlocked
    };

    // 2. Salva os dados detalhados no Banco de Dados (Firestore)
    // Isso é o que permite o Admin ver o usuário depois!
    await setDoc(doc(db, "users", firebaseUser.uid), newUser);

    // Se estiver bloqueado, desloga imediatamente para não deixar entrar
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
    // 1. Faz o login no Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // 2. Busca os dados do usuário no Banco para checar bloqueio
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      throw new Error("Usuário não encontrado no banco de dados.");
    }

    const userData = userDoc.data() as User;

    // 3. Verifica se está bloqueado (Pending Approval)
    if (userData.isBlocked) {
      await signOut(auth); // Desloga se tentar entrar
      throw new Error('Conta pendente de aprovação. Aguarde o administrador.');
    }

    return userData;
  } catch (error: any) {
    if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
      throw new Error('E-mail ou senha inválidos.');
    }
    throw error; // Repassa o erro de bloqueio
  }
};

export const logout = async () => {
  await signOut(auth);
};

// Esta função verifica se o usuário logado está atualizado
export const getCurrentUser = async (): Promise<User | null> => {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) return null;

  const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
  if (userDoc.exists()) {
    return userDoc.data() as User;
  }
  return null;
};

// --- Password Recovery ---

// O Firebase tem função nativa para isso, bem mais segura
import { sendPasswordResetEmail } from "firebase/auth";

export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
    // O Firebase envia um link pro email da pessoa automaticamente
  } catch (error) {
    throw new Error('Erro ao enviar email de recuperação.');
  }
};

// --- Admin Functions ---

// Agora sim! Busca TODOS os documentos da coleção 'users' na nuvem
export const getAllUsers = async (): Promise<User[]> => {
  const querySnapshot = await getDocs(collection(db, "users"));
  const users: User[] = [];
  querySnapshot.forEach((doc) => {
    users.push(doc.data() as User);
  });
  return users;
};

export const toggleUserBlock = async (userId: string): Promise<void> => {
  // Busca o usuário atual para ver o status
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    const userData = userSnap.data() as User;
    
    // Proteção: não bloquear admin
    if (userData.role === 'admin') return;

    // Inverte o status no banco
    await updateDoc(userRef, {
      isBlocked: !userData.isBlocked
    });
  }
};

export const deleteUser = async (userId: string): Promise<void> => {
    // Deleta do banco de dados (Visual)
    await deleteDoc(doc(db, "users", userId));
    // Nota: Deletar do Auth requer Cloud Functions (Backend), 
    // mas deletar do banco já impede o login pelo nosso check no 'login'.
};
