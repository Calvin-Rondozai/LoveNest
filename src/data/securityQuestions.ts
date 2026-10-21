export const SECURITY_QUESTIONS = [
  { id: 'mother_maiden', label: "What is your mother's maiden name?" },
  { id: 'first_pet', label: 'What was the name of your first pet?' },
  { id: 'birth_city', label: 'In which city were you born?' },
  { id: 'favourite_teacher', label: "What is your favourite teacher's name?" },
  { id: 'primary_school', label: 'What was the name of your primary school?' },
] as const;

export type SecurityQuestionId = (typeof SECURITY_QUESTIONS)[number]['id'];

export const SECURITY_QUESTION_IDS = SECURITY_QUESTIONS.map((q) => q.id);

export const securityQuestionLabel = (id: string) => SECURITY_QUESTIONS.find((q) => q.id === id)?.label ?? id;
