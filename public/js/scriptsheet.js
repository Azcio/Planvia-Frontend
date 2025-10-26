const { createApp, ref, watch, computed } = Vue

createApp({
  setup() {
    const username = ref('')
    const password = ref('')
    const message = ref('')
    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*]).{5,}$/
    const showRegister = ref(false)
    const showPassword = ref(false)
    const passwordValid = ref({
      length: false,
      uppercase: false,
      special: false,
    })

    // Track which page is currently active: 'login', 'home', 'timetable', 'edit'
    const page = ref('home')

    // JWT token
    const token = ref('')

    // Login function
    const login = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.value, password: password.value }),
        })

        const data = await res.json()

        if (res.ok) {
          localStorage.setItem('token', data.token)
          message.value = `Welcome ${data.username}!`
          page.value = 'home'
        } else {
          message.value = data.message

          // clear message after 5 seconds
          setTimeout(() => {
            message.value = ''
          }, 5000)
        }
      } catch (err) {
        message.value = 'Network error: ' + err.message
        setTimeout(() => {
          message.value = ''
        }, 5000)
      }
    }

    //validation logic
    const validatePassword = () => {
      const value = password.value
      passwordValid.value.length = value.length >= 5
      passwordValid.value.uppercase = /[A-Z]/.test(value)
      passwordValid.value.special = /[!@#$%^&*]/.test(value)
      passwordValid.value.number = /[0-9]/.test(value)
    }

    // Overall password validity
    const isPasswordValid = computed(
      () =>
        passwordValid.value.length &&
        passwordValid.value.uppercase &&
        passwordValid.value.special &&
        passwordValid.value.number,
    )

    // Call validation on every input
    watch(password, validatePassword)

    // Register function
    const register = async () => {
      validatePassword()
      if (!isPasswordValid.value) {
        message.value = 'Password does not meet requirements.'
        setTimeout(() => (message.value = ''), 5000)
        return
      }

      try {
        const res = await fetch('http://localhost:5000/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.value,
            password: password.value,
          }),
        })
        const data = await res.json()

        if (res.ok) {
          message.value = '✅ Registered successfully! Please log in.'
          // Hide register form and show login again
          showRegister.value = false

          // Optionally clear the fields
          username.value = ''
          password.value = ''
        } else {
          message.value = data.message || 'Registration failed.'
        }

        setTimeout(() => (message.value = ''), 5000)
      } catch (err) {
        message.value = 'Network error: ' + err.message
        setTimeout(() => (message.value = ''), 5000)
      }
    }

    // Logout function
    const logout = () => {
      token.value = ''
      username.value = ''
      password.value = ''
      page.value = 'start'
      message.value = ''
    }

    // ============================ Schedule/Timetable page ===========================================
    const schedule = ref([])
    const selectedDate = ref(new Date()) // starts with today

    // Automatically get today's date and format it nicely
    const today = new Date()
    const formattedDate = computed(() => {
      const d = selectedDate.value
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0') // Months are 0-based
      const year = d.getFullYear()
      return `${day}/${month}/${year}`
    })

    // Navigate dates
    const nextDay = () => {
      const newDate = new Date(selectedDate.value)
      newDate.setDate(newDate.getDate() + 1)
      selectedDate.value = newDate
      fetchSchedule()
    }
    const previousDay = () => {
      const newDate = new Date(selectedDate.value)
      newDate.setDate(newDate.getDate() - 1)
      selectedDate.value = newDate
      fetchSchedule()
    }

    // Call this from the Home button
    const goToTimetable = () => {
      console.log('goToTimetable called')
      page.value = 'timetable'
      fetchSchedule()
    }

    // Fetch schedule for the selected date
    const fetchSchedule = async () => {
      try {
        const tokenStr = localStorage.getItem('token')
        if (!tokenStr) {
          console.warn('No token found in localStorage — user may not be logged in')
          schedule.value = []
          return
        }

        const dateToSend = formattedDate.value // DD/MM/YYYY (because you chose Option 1)
        console.log('Fetching schedule for date:', dateToSend)

        const res = await fetch(
          `http://localhost:5000/api/schedule/${encodeURIComponent(dateToSend)}`,
          {
            headers: { Authorization: 'Bearer ' + tokenStr },
          },
        )

        if (!res.ok) {
          console.error('Schedule fetch failed, status:', res.status)
          const errText = await res.text().catch(() => null)
          console.error('Response body:', errText)
          schedule.value = []
          return
        }

        const data = await res.json()
        // backend returns { activities: [...] } or schedule object — handle both
        schedule.value = data.activities ?? data.activities ?? data.schedule?.activities ?? []
        console.log('Schedule loaded:', schedule.value)
      } catch (err) {
        console.error('Error fetching schedule:', err)
        schedule.value = []
      }
    }

    // Automatically fetch schedule when page changes to "timetable"
    watch(page, (newPage) => {
      if (newPage === 'timetable') {
        fetchSchedule()
      }
    })

    // For adding/editing activities
    const newActivity = ref({
      time: '',
      activity: '',
      repeat: 'once',
      days: [],
    })
    const newTime = ref('')
    const editingIndex = ref(null)

    // Add or update an activity
    const saveActivity = async () => {
      if (!newActivity.value.time || !newActivity.value.activity) {
        alert('Please enter both time and activity')
        return
      }

      if (editingIndex.value !== null) {
        // Update existing activity
        schedule.value[editingIndex.value] = { ...newActivity.value }
        editingIndex.value = null
      } else {
        // Add new activity
        schedule.value.push({ ...newActivity.value })
      }

      //Sort activities by time (e.g. 01:30 before 22:30)
      schedule.value.sort((a, b) => {
        const timeA = a.time.padStart(5, '0')
        const timeB = b.time.padStart(5, '0')
        return timeA.localeCompare(timeB)
      })

      // Reset form
      newActivity.value = {
        time: '',
        activity: '',
        repeat: 'once',
        days: [],
      }

      // Save to backend
      await saveSchedule()
    }

    // Edit existing activity
    const editActivity = (index) => {
      editingIndex.value = index
      newActivity.value = { ...schedule.value[index] } // copy to avoid binding issues
    }

    // Cancel editing
    const cancelEdit = () => {
      editingIndex.value = null
      newActivity.value = { time: '', activity: '', repeat: 'once', days: [] }
    }

    // Delete an activity
    const deleteActivity = async (index) => {
      schedule.value.splice(index, 1)
      await saveSchedule()
    }

    // Save current day's schedule to backend
    const saveSchedule = async () => {
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:5000/api/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          date: formattedDate.value,
          activities: schedule.value,
        }),
      })
      const data = await res.json()
      console.log('Schedule saved:', data)
    }

    return {
      username,
      showPassword,
      password,
      message,
      showRegister,
      page,
      login,
      register,
      logout,
      schedule,
      formattedDate,
      nextDay,
      previousDay,
      goToTimetable,
      fetchSchedule,
      newActivity,
      editingIndex,
      saveActivity,
      editActivity,
      deleteActivity,
      cancelEdit,
    }
  },
}).mount('#app')
