import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-4xl w-full">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Medical Administration Record (MAR)
        </h1>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-white">
            Welcome to Chartbuddies V2
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            This is your MAR demo application built with:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300 mb-8">
            <li>Next.js 12 with TypeScript</li>
            <li>Tailwind CSS for styling</li>
            <li>Vercel Pro for deployment</li>
            <li>Supabase for database</li>
          </ul>
          <div className="flex justify-center">
            <Link href="/admissions">
              <a className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-lg font-semibold">
                Go to Admissions Form
              </a>
            </Link>
          </div>
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-blue-800 dark:text-blue-200 font-semibold">
              ✓ Application is running successfully!
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

