import { Builder, By, until } from 'selenium-webdriver'
import chrome from 'selenium-webdriver/chrome.js'

const BASE_URL = process.env.TEAMTOWER_BASE_URL || 'https://teamtower.onrender.com'
const ADMIN_EMAIL = process.env.TEAMTOWER_ADMIN_EMAIL || 'admin@email.com'
const ADMIN_PASSWORD = process.env.TEAMTOWER_ADMIN_PASSWORD || 'admin@123'
const HEADLESS = process.env.HEADLESS !== 'false'
const USE_BUNDLED_CHROMEDRIVER = process.env.USE_BUNDLED_CHROMEDRIVER === 'true'
const WAIT_TIMEOUT = Number(process.env.SELENIUM_TIMEOUT_MS || 90000)

const formatDateInput = (value) => {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const addDays = (date, days) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const buildTestData = () => {
  const seed = `${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const today = new Date()

  return {
    seed,
    userName: `Selenium User ${seed}`,
    userEmail: `selenium.user.${seed}@example.com`,
    userPassword: `Selenium@${seed.replace(/-/g, '')}`,
    projectName: `Selenium Project ${seed}`,
    projectDescription: `Hosted end-to-end validation for run ${seed}`,
    taskTitle: `Selenium Task ${seed}`,
    taskDescription: `Verify admin assignment and user execution for ${seed}`,
    plannedWork: `Plan work for ${seed}`,
    actualWork: `Completed work for ${seed}`,
    timelineNote: `Timeline reviewed during Selenium run ${seed}`,
    startDate: formatDateInput(today),
    endDate: formatDateInput(addDays(today, 7)),
    dueDate: formatDateInput(addDays(today, 3)),
  }
}

const xpathLiteral = (value) => {
  if (!value.includes("'")) return `'${value}'`
  if (!value.includes('"')) return `"${value}"`

  return `concat(${value
    .split("'")
    .map((part) => `'${part}'`)
    .join(`, "'", `)})`
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const log = (message) => {
  console.log(`[selenium] ${message}`)
}

const fail = async (driver, error) => {
  const currentUrl = await driver.getCurrentUrl().catch(() => 'unavailable')
  const title = await driver.getTitle().catch(() => 'unavailable')
  const bodyText = await driver
    .findElement(By.tagName('body'))
    .getText()
    .then((text) => text.slice(0, 1200))
    .catch(() => 'body text unavailable')

  console.error('\n[selenium] Test failed')
  console.error(`[selenium] URL: ${currentUrl}`)
  console.error(`[selenium] Title: ${title}`)
  console.error(`[selenium] Error: ${error.stack || error.message || error}`)
  console.error(`[selenium] Body excerpt:\n${bodyText}`)
}

const buildDriver = async () => {
  const options = new chrome.Options()

  if (HEADLESS) {
    options.addArguments('--headless=new')
  }

  options.addArguments('--window-size=1440,1600')
  options.addArguments('--disable-gpu')
  options.addArguments('--no-sandbox')
  options.addArguments('--disable-dev-shm-usage')

  const builder = new Builder().forBrowser('chrome').setChromeOptions(options)

  if (USE_BUNDLED_CHROMEDRIVER) {
    const chromedriver = await import('chromedriver')
    const service = new chrome.ServiceBuilder(chromedriver.default.path)
    builder.setChromeService(service)
  }

  const driver = await builder.build()

  await driver.manage().setTimeouts({
    implicit: 0,
    pageLoad: WAIT_TIMEOUT,
    script: WAIT_TIMEOUT,
  })

  return driver
}

const waitFor = async (driver, condition, message, timeout = WAIT_TIMEOUT) => {
  return driver.wait(condition, timeout, message)
}

const waitForVisible = async (driver, locator, timeout = WAIT_TIMEOUT) => {
  const element = await waitFor(driver, until.elementLocated(locator), `Could not locate ${locator}`, timeout)
  await waitFor(driver, until.elementIsVisible(element), 'Element did not become visible', timeout)
  return element
}

const waitForText = async (driver, text, timeout = WAIT_TIMEOUT) => {
  const locator = By.xpath(`//*[contains(normalize-space(.), ${xpathLiteral(text)})]`)
  return waitForVisible(driver, locator, timeout)
}

const waitForUrlIncludes = async (driver, text, timeout = WAIT_TIMEOUT) => {
  await waitFor(
    driver,
    async () => {
      const currentUrl = await driver.getCurrentUrl()
      return currentUrl.includes(text)
    },
    `URL did not include ${text}`,
    timeout,
  )
}

const clearAndType = async (driver, locator, value) => {
  const input = await waitForVisible(driver, locator)
  await scrollIntoView(driver, input)
  await input.clear()
  await input.sendKeys(value)
  return input
}

const setInputValue = async (driver, element, value) => {
  await scrollIntoView(driver, element)
  await driver.executeScript(
    `
      const input = arguments[0]
      const nextValue = arguments[1]
      const prototype = input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')

      descriptor.set.call(input, nextValue)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      input.blur()
    `,
    element,
    value,
  )

  await waitFor(
    driver,
    async () => (await element.getAttribute('value')) === value,
    `Input value did not update to ${value}`,
  )
}

const scrollIntoView = async (driver, element) => {
  await driver.executeScript(
    "arguments[0].scrollIntoView({ block: 'center', inline: 'nearest' });",
    element,
  )
}

const safeClick = async (driver, element) => {
  await scrollIntoView(driver, element)

  try {
    await element.click()
  } catch {
    await driver.executeScript('arguments[0].click();', element)
  }
}

const click = async (driver, locator) => {
  const element = await waitForVisible(driver, locator)
  await safeClick(driver, element)
  return element
}

const waitForOptionText = async (driver, locator, text, exact = true) => {
  await waitFor(
    driver,
    async () => {
      const select = await driver.findElement(locator).catch(() => null)
      if (!select) return false

      const options = await select.findElements(By.css('option'))
      for (const option of options) {
        const optionText = (await option.getText()).trim()
        if (exact ? optionText === text : optionText.includes(text)) {
          return true
        }
      }

      return false
    },
    `Option "${text}" was not found`,
  )
}

const selectOption = async (driver, locator, text, { exact = true } = {}) => {
  await waitForOptionText(driver, locator, text, exact)
  const select = await waitForVisible(driver, locator)
  await scrollIntoView(driver, select)

  const success = await driver.executeScript(
    `
      const select = arguments[0]
      const targetText = arguments[1].trim()
      const exact = arguments[2]
      const option = [...select.options].find((item) => {
        const value = item.text.trim()
        return exact ? value === targetText : value.includes(targetText)
      })

      if (!option) return false

      select.value = option.value
      select.dispatchEvent(new Event('input', { bubbles: true }))
      select.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    `,
    select,
    text,
    exact,
  )

  if (!success) {
    throw new Error(`Could not select option "${text}"`)
  }
}

const waitForAlert = async (driver, text) => {
  const locator = By.xpath(
    `//*[contains(@class, 'alert') and contains(normalize-space(.), ${xpathLiteral(text)})]`,
  )
  return waitForVisible(driver, locator)
}

const waitForAbsent = async (driver, locator, timeout = WAIT_TIMEOUT) => {
  await waitFor(
    driver,
    async () => {
      const elements = await driver.findElements(locator)
      if (!elements.length) return true

      for (const element of elements) {
        if (await element.isDisplayed().catch(() => false)) {
          return false
        }
      }

      return true
    },
    `Element did not disappear: ${locator}`,
    timeout,
  )
}

const acceptConfirmation = async (driver) => {
  await waitFor(driver, until.alertIsPresent(), 'Confirmation dialog did not appear')
  const alert = await driver.switchTo().alert()
  const text = await alert.getText().catch(() => '')

  if (text) {
    log(`CONFIRM: ${text}`)
  }

  await alert.accept()
}

const clickLogout = async (driver) => {
  await driver.executeScript('window.scrollTo(0, 0);')
  const logoutButton = await waitForVisible(driver, By.xpath("//button[normalize-space()='Logout']"))
  await safeClick(driver, logoutButton)
  await waitForUrlIncludes(driver, '/login')
}

const login = async (driver, email, password, expectedPath) => {
  await clearAndType(driver, By.css("input[placeholder='admin@email.com']"), email)
  await clearAndType(driver, By.css("input[placeholder='Enter your password']"), password)
  await click(driver, By.xpath("//button[normalize-space()='Sign in']"))
  await waitForUrlIncludes(driver, expectedPath)
}

const step = async (name, action) => {
  log(`START: ${name}`)
  const startedAt = Date.now()
  await action()
  const duration = ((Date.now() - startedAt) / 1000).toFixed(1)
  log(`PASS: ${name} (${duration}s)`)
}

const run = async () => {
  const driver = await buildDriver()
  const data = buildTestData()

  try {
    await step('Open hosted app login page', async () => {
      await driver.get(BASE_URL)
      await waitFor(driver, async () => (await driver.executeScript('return document.readyState')) === 'complete', 'Document did not finish loading')
      await waitForUrlIncludes(driver, '/login')
      await waitForText(driver, 'Task Allocation Platform')
    })

    await step('Admin login', async () => {
      await login(driver, ADMIN_EMAIL, ADMIN_PASSWORD, '/admin')
      await waitForText(driver, 'Admin Control Center')
    })

    await step('Create a unique user from the admin dashboard', async () => {
      await clearAndType(driver, By.css("#users input[placeholder='Full name']"), data.userName)
      await clearAndType(driver, By.css("#users input[placeholder='Email']"), data.userEmail)
      await clearAndType(driver, By.css("#users input[placeholder='Password']"), data.userPassword)
      await click(driver, By.xpath("//*[@id='users']//button[normalize-space()='Create user']"))
      await waitForAlert(driver, 'User created successfully')
      await waitForText(driver, data.userEmail)
    })

    await step('Create a project and assign the new user', async () => {
      await clearAndType(driver, By.css("#projects input[placeholder='Project name']"), data.projectName)
      await clearAndType(driver, By.css("#projects textarea[placeholder='Description']"), data.projectDescription)

      const dateInputs = await driver.findElements(By.css('#projects input[type="date"]'))
      if (dateInputs.length < 2) {
        throw new Error('Project start and end date inputs were not found')
      }

      await setInputValue(driver, dateInputs[0], data.startDate)
      await setInputValue(driver, dateInputs[1], data.endDate)

      const memberButton = await waitForVisible(
        driver,
        By.xpath(
          `//*[@id='projects']//button[contains(@class, 'member-card')][.//*[normalize-space()=${xpathLiteral(data.userName)}]]`,
        ),
      )
      await safeClick(driver, memberButton)

      await click(driver, By.xpath("//*[@id='projects']//button[normalize-space()='Create project']"))
      await waitForAlert(driver, 'Project created successfully')
      await waitForOptionText(
        driver,
        By.xpath("//*[@id='projects']//label[contains(normalize-space(.), 'Active project')]//select"),
        data.projectName,
      )
    })

    await step('Update the new project timeline', async () => {
      const activeProjectLocator = By.xpath(
        "//*[@id='projects']//label[contains(normalize-space(.), 'Active project')]//select",
      )
      const completionLocator = By.css('#projects input[type="number"]')
      const timelineNoteLocator = By.css("#projects textarea[placeholder='Timeline note']")
      const timelineStatusLocator = By.xpath(
        "//*[@id='projects']//label[contains(normalize-space(.), 'Status label')]//select",
      )

      await selectOption(driver, activeProjectLocator, data.projectName)
      await sleep(1000)
      await clearAndType(driver, completionLocator, '15')
      await selectOption(driver, timelineStatusLocator, 'on-track')
      await clearAndType(driver, timelineNoteLocator, data.timelineNote)
      await click(driver, By.xpath("//*[@id='projects']//button[normalize-space()='Update timeline']"))
      await waitForAlert(driver, 'Project timeline updated')
      await waitForText(driver, '15%')
    })

    await step('Create a task for the new user', async () => {
      const taskProjectLocator = By.xpath(
        "//*[@id='tasks']//label[contains(normalize-space(.), 'Project')]//select",
      )
      const assigneeLocator = By.xpath(
        "//*[@id='tasks']//label[contains(normalize-space(.), 'Assignee')]//select",
      )
      const priorityLocator = By.xpath(
        "//*[@id='tasks']//label[contains(normalize-space(.), 'Priority')]//select",
      )
      const statusLocator = By.xpath(
        "//*[@id='tasks']//label[contains(normalize-space(.), 'Initial status')]//select",
      )

      await selectOption(driver, taskProjectLocator, data.projectName)
      await selectOption(driver, assigneeLocator, data.userName)
      await clearAndType(driver, By.css("#tasks input[placeholder='Task title']"), data.taskTitle)
      await clearAndType(driver, By.css("#tasks textarea[placeholder='Description']"), data.taskDescription)
      await selectOption(driver, priorityLocator, 'high')

      const dueDateInput = await waitForVisible(
        driver,
        By.xpath("//*[@id='tasks']//label[contains(normalize-space(.), 'Due date')]//input"),
      )
      await setInputValue(driver, dueDateInput, data.dueDate)

      await selectOption(driver, statusLocator, 'todo')
      await click(driver, By.xpath("//*[@id='tasks']//button[normalize-space()='Create task']"))
      await waitForAlert(driver, 'Task created and assigned')
      await waitForText(driver, data.taskTitle)
    })

    await step('Admin logout', async () => {
      await clickLogout(driver)
    })

    await step('Created user login', async () => {
      await login(driver, data.userEmail, data.userPassword, '/user')
      await waitForText(driver, 'My Workboard')
    })

    await step('User check-in flow', async () => {
      const assignedProjectLocator = By.xpath(
        "//*[@id='projects']//label[contains(normalize-space(.), 'Assigned project')]//select",
      )
      const taskLocator = By.xpath(
        "//*[@id='workday']//label[contains(normalize-space(.), 'Task')]//select",
      )

      await selectOption(driver, assignedProjectLocator, data.projectName)
      await selectOption(driver, taskLocator, data.taskTitle, { exact: false })
      await clearAndType(
        driver,
        By.css("#workday textarea[placeholder='What are you planning to do in this session?']"),
        data.plannedWork,
      )
      await click(driver, By.xpath("//*[@id='workday']//button[normalize-space()='Check in']"))
      await waitForAlert(driver, 'Check-in recorded')
      await waitForText(driver, `Task: ${data.taskTitle}`)
    })

    await step('User check-out flow', async () => {
      const checkoutStatusLocator = By.xpath(
        "//*[@id='workday']//label[contains(normalize-space(.), 'Move task to')]//select",
      )

      await clearAndType(
        driver,
        By.css("#workday textarea[placeholder='What did you complete in this session?']"),
        data.actualWork,
      )
      await selectOption(driver, checkoutStatusLocator, 'In Progress')
      await click(driver, By.xpath("//*[@id='workday']//button[normalize-space()='Check out']"))
      await waitForAlert(driver, 'Check-out recorded and task updated')
    })

    await step('Move the task to completed from the user Kanban board', async () => {
      const inProgressTaskCardLocator = By.xpath(
        `//*[@id='kanban']//section[.//h3[normalize-space()='In Progress']]//article[contains(@class, 'task-card')][.//p[normalize-space()=${xpathLiteral(
          data.taskTitle,
        )}]]`,
      )

      const taskCard = await waitForVisible(driver, inProgressTaskCardLocator)
      const details = await taskCard.findElement(By.css('details'))
      await driver.executeScript("arguments[0].open = true; arguments[0].setAttribute('open', '');", details)

      const completedButton = await waitFor(
        driver,
        async () => {
          const buttons = await driver.findElements(
            By.xpath(
              `//*[@id='kanban']//section[.//h3[normalize-space()='In Progress']]//article[.//p[normalize-space()=${xpathLiteral(
                data.taskTitle,
              )}]]//button[normalize-space()='Completed']`,
            ),
          )
          return buttons[0] || null
        },
        'Completed quick action was not available for the task',
      )
      await driver.executeScript('arguments[0].click();', completedButton)
      await waitForAlert(driver, 'Task moved successfully')
      await waitForVisible(
        driver,
        By.xpath(
          `//*[@id='kanban']//section[.//h3[normalize-space()='Completed']]//article[.//p[normalize-space()=${xpathLiteral(
            data.taskTitle,
          )}]]`,
        ),
      )
    })

    await step('Verify the user session history popup', async () => {
      await click(driver, By.xpath("//*[@id='sessions']//button[normalize-space()='Month']"))
      const activeMonthCell = await waitForVisible(
        driver,
        By.css('#sessions .session-month-cell.active'),
      )
      await safeClick(driver, activeMonthCell)
      await waitForText(driver, data.taskTitle)
      await waitForText(driver, data.plannedWork)
      await waitForText(driver, data.actualWork)
      await click(driver, By.xpath("//button[normalize-space()='Close']"))
    })

    await step('User logout', async () => {
      await clickLogout(driver)
    })

    await step('Admin login again for final verification', async () => {
      await login(driver, ADMIN_EMAIL, ADMIN_PASSWORD, '/admin')
      await waitForText(driver, 'Admin Control Center')
    })

    await step('Verify admin can see the created user, completed task, and recorded session', async () => {
      await waitForText(driver, data.userEmail)

      const activeProjectLocator = By.xpath(
        "//*[@id='projects']//label[contains(normalize-space(.), 'Active project')]//select",
      )
      await selectOption(driver, activeProjectLocator, data.projectName)
      await waitForVisible(
        driver,
        By.xpath(
          `//*[@id='tasks']//tr[td[normalize-space()=${xpathLiteral(data.taskTitle)}] and td[normalize-space()='completed']]`,
        ),
      )

      await click(driver, By.xpath("//*[@id='sessions']//button[normalize-space()='Month']"))
      const monthInput = await waitForVisible(driver, By.css("#sessions input[type='month']"))
      const monthValue = data.startDate.slice(0, 7)
      await setInputValue(driver, monthInput, monthValue)
      await click(driver, By.xpath("//*[@id='sessions']//button[normalize-space()='Load']"))
      await waitForText(driver, data.userName)
    })

    await step('Delete the generated task from the admin UI', async () => {
      const taskRowLocator = By.xpath(
        `//*[@id='tasks']//tr[td[normalize-space()=${xpathLiteral(data.taskTitle)}]]`,
      )
      const deleteTaskButtonLocator = By.xpath(
        `//*[@id='tasks']//tr[td[normalize-space()=${xpathLiteral(data.taskTitle)}]]//button[normalize-space()='Delete']`,
      )

      await waitForVisible(driver, taskRowLocator)
      const deleteTaskButtons = await driver.findElements(deleteTaskButtonLocator)
      if (!deleteTaskButtons.length) {
        throw new Error(
          'Hosted admin UI does not expose the task Delete button yet. Deploy the updated admin delete actions before rerunning cleanup.',
        )
      }

      await safeClick(driver, deleteTaskButtons[0])
      await acceptConfirmation(driver)
      await waitForAlert(driver, 'Task deleted successfully')
      await waitForAbsent(driver, taskRowLocator)
    })

    await step('Delete the generated project from the admin UI', async () => {
      const activeProjectLocator = By.xpath(
        "//*[@id='projects']//label[contains(normalize-space(.), 'Active project')]//select",
      )

      await selectOption(driver, activeProjectLocator, data.projectName)
      const deleteProjectButtons = await driver.findElements(
        By.xpath("//*[@id='projects']//button[normalize-space()='Delete selected project']"),
      )
      if (!deleteProjectButtons.length) {
        throw new Error(
          'Hosted admin UI does not expose the project delete action yet. Deploy the updated admin delete actions before rerunning cleanup.',
        )
      }

      await safeClick(driver, deleteProjectButtons[0])
      await acceptConfirmation(driver)
      await waitForAlert(driver, 'Project deleted successfully')
      await waitFor(
        driver,
        async () => {
          const select = await driver.findElement(activeProjectLocator).catch(() => null)
          if (!select) return false

          const options = await select.findElements(By.css('option'))
          for (const option of options) {
            if ((await option.getText()).trim() === data.projectName) {
              return false
            }
          }

          return true
        },
        `Project option "${data.projectName}" was not removed`,
      )
    })

    await step('Delete the generated user from the admin UI', async () => {
      const userRowLocator = By.xpath(
        `//*[@id='users']//tr[td[normalize-space()=${xpathLiteral(data.userEmail)}]]`,
      )
      const deleteUserButtonLocator = By.xpath(
        `//*[@id='users']//tr[td[normalize-space()=${xpathLiteral(data.userEmail)}]]//button[normalize-space()='Delete']`,
      )

      await waitForVisible(driver, userRowLocator)
      const deleteUserButtons = await driver.findElements(deleteUserButtonLocator)
      if (!deleteUserButtons.length) {
        throw new Error(
          'Hosted admin UI does not expose the user Delete button yet. Deploy the updated admin delete actions before rerunning cleanup.',
        )
      }

      await safeClick(driver, deleteUserButtons[0])
      await acceptConfirmation(driver)
      await waitForAlert(driver, 'User deleted successfully')
      await waitForAbsent(driver, userRowLocator)
    })

    log('\nAll hosted admin and user flows completed successfully, and the generated UI test data was deleted.')
    log(`Deleted user: ${data.userEmail}`)
    log(`Deleted project: ${data.projectName}`)
    log(`Deleted task: ${data.taskTitle}`)
  } catch (error) {
    await fail(driver, error)
    process.exitCode = 1
  } finally {
    await driver.quit()
  }
}

run()
