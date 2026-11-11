import { ProfileScreen } from "../src/screens/ProfileScreen";
import { useSession } from "../src/session/SessionContext";

export default function CompleteProfile() {
  const { register, signOut } = useSession();
  return <ProfileScreen onRegister={register} onSignOut={signOut} />;
}
