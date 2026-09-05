import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';

interface AuthorInfoProps {
  pubkey: string;
  showAvatar?: boolean;
  className?: string;
}

export function AuthorInfo({ pubkey, showAvatar = true, className = '' }: AuthorInfoProps) {
  const { data: author } = useAuthor(pubkey);
  
  const authorName = author?.metadata?.name || genUserName(pubkey);
  const authorAvatar = author?.metadata?.picture;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showAvatar && (
        <Avatar className="h-5 w-5">
          {authorAvatar && <AvatarImage src={authorAvatar} alt={authorName} />}
          <AvatarFallback className="text-xs">{authorName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
      <span className="text-sm font-medium">{authorName}</span>
    </div>
  );
}