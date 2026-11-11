import { StyleSheet } from "react-native";

/** Styles that the screens share. */
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff", justifyContent: "center", padding: 24 },
  title: { fontSize: 28, fontWeight: "600", marginBottom: 24, textAlign: "center" },
  label: { fontSize: 14, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#888", borderRadius: 8, fontSize: 16, marginBottom: 16, padding: 12 },
  button: { alignItems: "center", backgroundColor: "#1f5fbf", borderRadius: 8, marginTop: 8, padding: 14 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { alignItems: "center", marginTop: 16, padding: 8 },
  linkText: { color: "#1f5fbf", fontSize: 16 },
  error: { color: "#b00020", fontSize: 14, marginBottom: 8 },
  text: { fontSize: 16, marginBottom: 16, textAlign: "center" },
  row: { alignItems: "center", flexDirection: "row", marginBottom: 16 },
  rowText: { flex: 1, fontSize: 14, marginLeft: 12 },
});
