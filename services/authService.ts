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

// --- Funções Auxiliares ---

// ESTA É A FUNÇÃO QUE FALTAVA
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

    const isAdmin = email === 'admin@parnaso.com';
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
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      throw new Error("Usuário sem registro no banco de dados.");
    }

    const userData = userDoc.data() as User;

    if (userData.isBlocked) {
      await signOut(auth);
      throw new Error('Conta pendente de aprovação. Aguarde o administrador.');
    }

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
    if (userData.role === 'admin') return;

    await updateDoc(userRef, {
      isBlocked: !userData.isBlocked
    });
  }
};

export const deleteUser = async (userId: string): Promise<void> => {
  await deleteDoc(doc(db, "users", userId));
};
