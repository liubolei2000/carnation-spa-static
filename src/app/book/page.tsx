import { redirect } from 'next/navigation'

export default function BookPage() {
  redirect('/?book=1')
}
