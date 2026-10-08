import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

type Props = { name: string; iconSet?: 'ion' | 'mci'; size?: number; color: string };

export const Icon = ({ name, iconSet = 'ion', size = 22, color }: Props) =>
  iconSet === 'mci' ? (
    <MaterialCommunityIcons name={name as any} size={size} color={color} />
  ) : (
    <Ionicons name={name as any} size={size} color={color} />
  );
