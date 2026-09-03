export default function useMsalUser() {
  return {
    user: {
      name: "Gast",
      department: "B.E.R.N.D. Chatbot",
      avatarUrl: null,
    },
    loading: false,
    error: null,
    refetch: () => {},
  };
}
