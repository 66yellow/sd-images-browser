let image_browser_state = "free"
let image_browser_webui_ready = false
let image_browser_started = false

function image_browser_delay(ms){return new Promise(resolve => setTimeout(resolve, ms))}

onUiLoaded(image_browser_start_it_up)

async function image_browser_wait_for_webui() { 
    await image_browser_delay(100)
    while (gradioApp().getElementById("setting_sd_model_checkpoint").querySelector(".eta-bar")) {
        await image_browser_delay(200)
    }
    image_browser_webui_ready = true
    image_browser_start()
}

async function image_browser_start_it_up() {
    container = gradioApp().getElementById("image_browser_tabs_container")
    let controls = container.querySelectorAll('[id*="_control_"]')
    controls.forEach(function(control) {
        control.style.pointerEvents = "none"
        control.style.cursor = "not-allowed"
        control.style.opacity = "0.65"
    })
    let warnings = container.querySelectorAll('[id*="_warning_box"]')
    warnings.forEach(function(warning) {
        warning.innerHTML = '<p style="font-weight: bold;">Waiting for webui...'
    })

    image_browser_wait_for_webui()
}

async function image_browser_lock(reason) {
    // Wait until lock removed
    let i = 0
    while (image_browser_state != "free") {
        await image_browser_delay(200)
        i = i + 1
        if (i === 150) {
            throw new Error("Still locked after 30 seconds. Please Reload UI.")
        }
    }
    // Lock
    image_browser_state = reason
}

async function image_browser_unlock() {
    image_browser_state = "free"
}

const image_browser_click_image = async function() {
    await image_browser_lock("image_browser_click_image")
    const tab_base_tag = image_browser_current_tab()
    const container = gradioApp().getElementById(tab_base_tag + "_image_browser_container")
    let child = this
    let index = 0
    while((child = child.previousSibling) != null) {
        index = index + 1
    }
    const set_btn = container.querySelector(".image_browser_set_index")
    let curr_idx
    try {
        curr_idx = set_btn.getAttribute("img_index")
    } catch (e) {
        curr_idx = -1
    }
    if (curr_idx != index) {
        set_btn.setAttribute("img_index", index)
    }
    await image_browser_unlock()
    set_btn.click()
}

async function image_browser_get_current_img(tab_base_tag, img_index, page_index, filenames, turn_page_switch, image_gallery) {
    await image_browser_lock("image_browser_get_current_img")
    img_index = gradioApp().getElementById(tab_base_tag + '_image_browser_set_index').getAttribute("img_index")
    gradioApp().dispatchEvent(new Event("image_browser_get_current_img"))
    await image_browser_unlock()
    return [
        tab_base_tag,
        img_index,
        page_index,
		filenames,
        turn_page_switch,
        image_gallery
    ]
}

async function image_browser_refresh_current_page_preview() { 
    await image_browser_delay(200)
    const preview_div = gradioApp().querySelector('.preview')
    if (preview_div === null) return
    const tab_base_tag = image_browser_current_tab()
    const gallery = gradioApp().querySelector(`#${tab_base_tag}_image_browser`)
    const set_btn = gallery.querySelector(".image_browser_set_index")
    const curr_idx = parseInt(set_btn.getAttribute("img_index"))
    // no loading animation, so click immediately
    const gallery_items = gallery.querySelectorAll(".thumbnail-item")
    const curr_image = gallery_items[curr_idx]
    curr_image.click()
}

async function image_browser_turnpage(tab_base_tag) {
    while (!image_browser_started) {
        await image_browser_delay(200)
    }
    const gallery = gradioApp().querySelector(`#${tab_base_tag}_image_browser`)
    let clear
    try {
        clear = gallery.querySelector("button[aria-label='Clear']")
        if (clear) {
            clear.click()
        }
    } catch (e) {
        console.error(e)
    }
}

const image_browser_get_current_img_handler = (del_img_btn) => {
    // Prevent delete button spam
    del_img_btn.style.pointerEvents = "auto"
    del_img_btn.style.cursor = "default"
    del_img_btn.style.opacity = "1"
}

async function image_browser_select_image(tab_base_tag, img_index, select_image) {
    if (select_image) {
        await image_browser_lock("image_browser_select_image")
        const del_img_btn = gradioApp().getElementById(tab_base_tag + "_image_browser_del_img_btn")
        // Prevent delete button spam
        del_img_btn.style.pointerEvents = "none"
        del_img_btn.style.cursor = "not-allowed"
        del_img_btn.style.opacity = "0.65"        

        const gallery = gradioApp().getElementById(tab_base_tag + "_image_browser_gallery")
        const gallery_items = gallery.querySelectorAll(".thumbnail-item")
        if (img_index >= gallery_items.length || gallery_items.length == 0) {
            const refreshBtn = gradioApp().getElementById(tab_base_tag + "_image_browser_renew_page")
            refreshBtn.dispatchEvent(new Event("click"))
        } else {
            const curr_image = gallery_items[img_index]
            curr_image.click()
        }
        await image_browser_unlock()

        // Prevent delete button spam
        gradioApp().removeEventListener("image_browser_get_current_img", () => image_browser_get_current_img_handler(del_img_btn))
        gradioApp().addEventListener("image_browser_get_current_img", () => image_browser_get_current_img_handler(del_img_btn))
    }
}

async function image_browser_gototab(tabname) {
    await image_browser_lock("image_browser_gototab")

    tabNav = gradioApp().querySelector(".tab-nav")
    const tabNavChildren = tabNav.children
    let tabNavButtonNum
    for (let i = 0; i < tabNavChildren.length; i++) {
        if (tabNavChildren[i].tagName === "BUTTON" && tabNavChildren[i].textContent.trim() === tabname) {
            tabNavButtonNum = i
            break
        }
    }
    let tabNavButton = tabNavChildren[tabNavButtonNum]
    tabNavButton.click()

    // Wait for click-action to complete
    const startTime = Date.now()
    // 60 seconds in milliseconds
    const timeout = 60000
    
    await image_browser_delay(100)
    while (!tabNavButton.classList.contains("selected")) {
        tabNavButton = tabNavChildren[tabNavButtonNum]
        if (Date.now() - startTime > timeout) {
            throw new Error("image_browser_gototab: 60 seconds have passed")
        }
        await image_browser_delay(200)
    }

    await image_browser_unlock()
}

async function image_browser_get_image_for_ext(tab_base_tag, image_index) {
    const image_browser_image = gradioApp().querySelectorAll(`#${tab_base_tag}_image_browser_gallery .thumbnail-item`)[image_index]

	const canvas = document.createElement("canvas")
	const image = document.createElement("img")
	image.src = image_browser_image.querySelector("img").src

	await image.decode()

	canvas.width = image.width
	canvas.height = image.height

	canvas.getContext("2d").drawImage(image, 0, 0)

	return canvas.toDataURL()
}

function image_browser_openoutpaint_send(tab_base_tag, image_index, image_browser_prompt, image_browser_neg_prompt, name = "WebUI Resource") {
    image_browser_get_image_for_ext(tab_base_tag, image_index)
		.then((dataURL) => {
			// Send to openOutpaint
			openoutpaint_send_image(dataURL, name)

			// Send prompt to openOutpaint
			const tab = get_uiCurrentTabContent().id

			const prompt = image_browser_prompt
            const negPrompt = image_browser_neg_prompt
            openoutpaint.frame.contentWindow.postMessage({
                key: openoutpaint.key,
                type: "openoutpaint/set-prompt",
                prompt,
                negPrompt,
            })

			// Change Tab
            image_browser_gototab("openOutpaint")
		})
}

async function image_browser_controlnet_send(toTab, tab_base_tag, image_index, controlnetNum, controlnetType) {
    // Logic originally based on github.com/fkunn1326/openpose-editor
    const dataURL = await image_browser_get_image_for_ext(tab_base_tag, image_index)
    const blob = await (await fetch(dataURL)).blob()
    const dt = new DataTransfer()
    dt.items.add(new File([blob], "ImageBrowser.png", { type: blob.type }))
    const list = dt.files

    await image_browser_gototab(toTab)
    const current_tab = gradioApp().getElementById("tab_" + toTab)
    const mode = current_tab.querySelector("#controlnet")
    let accordion = current_tab.querySelector("#controlnet > .label-wrap > .icon")
    if (accordion.style.transform.includes("rotate(90deg)")) {
        accordion.click()
        // Wait for click-action to complete
        const startTime = Date.now()
        // 60 seconds in milliseconds
        const timeout = 60000
    
        await image_browser_delay(100)
        while (accordion.style.transform.includes("rotate(90deg)")) {
            accordion = mode.querySelector("#controlnet > .label-wrap > .icon")
            if (Date.now() - startTime > timeout) {
                throw new Error("image_browser_controlnet_send/accordion: 60 seconds have passed")
            }
            await image_browser_delay(200)
        }
    }    

    let inputContainer = null
    if (controlnetType == "single") {
        try {
            inputContainer = mode.querySelector('div[data-testid="image"]')
        } catch (e) {}
    } else {
        const tab_num = (parseInt(controlnetNum) + 1).toString()
        tab_button = mode.querySelector(".tab-nav button:nth-child(" + tab_num + ")")
        tab_button.click()
        // Wait for click-action to complete
        const startTime = Date.now()
        // 60 seconds in milliseconds
        const timeout = 60000
    
        await image_browser_delay(100)
        while (!tab_button.classList.contains("selected")) {
            tab_button = mode.querySelector(".tab-nav button:nth-child(" + tab_num + ")")
            if (Date.now() - startTime > timeout) {
                throw new Error("image_browser_controlnet_send/tabs: 60 seconds have passed")
            }
            await image_browser_delay(200)
        }
        try {
            tab = mode.querySelectorAll(".tabitem")[controlnetNum]
            inputContainer = tab.querySelector('div[data-testid="image"]')
        } catch (e) {}
    }
    const input = inputContainer.querySelector("input[type='file']")

    let clear
    try {
        clear = inputContainer.querySelector("button[aria-label='Clear']")
        if (clear) {
            clear.click()
        }
    } catch (e) {
        console.error(e)
    }

    try {
        // Wait for click-action to complete
        const startTime = Date.now()
        // 60 seconds in milliseconds
        const timeout = 60000
        while (clear) {
            clear = inputContainer.querySelector("button[aria-label='Clear']")
            if (Date.now() - startTime > timeout) {
                throw new Error("image_browser_controlnet_send/clear: 60 seconds have passed")
            }
            await image_browser_delay(200)
        }
    } catch (e) {
        console.error(e)
    }

    input.value = ""
    input.files = list
    const event = new Event("change", { "bubbles": true, "composed": true })
    input.dispatchEvent(event)
}

function image_browser_controlnet_send_txt2img(tab_base_tag, image_index, controlnetNum, controlnetType) {
    image_browser_controlnet_send("txt2img", tab_base_tag, image_index, controlnetNum, controlnetType)
}
  
function image_browser_controlnet_send_img2img(tab_base_tag, image_index, controlnetNum, controlnetType) {
    image_browser_controlnet_send("img2img", tab_base_tag, image_index, controlnetNum, controlnetType)
}

function image_browser_class_add(tab_base_tag) {
    gradioApp().getElementById(tab_base_tag + '_image_browser').classList.add("image_browser_container")
    gradioApp().getElementById(tab_base_tag + '_image_browser_set_index').classList.add("image_browser_set_index")
    gradioApp().getElementById(tab_base_tag + '_image_browser_del_img_btn').classList.add("image_browser_del_img_btn")
    gradioApp().getElementById(tab_base_tag + '_image_browser_gallery').classList.add("image_browser_gallery")
}

function btnClickHandler(tab_base_tag, btn) {
    const tabs_box = gradioApp().getElementById("image_browser_tabs_container")
    if (!tabs_box.classList.contains(tab_base_tag)) {
        gradioApp().getElementById(tab_base_tag + "_image_browser_renew_page").click()
        tabs_box.classList.add(tab_base_tag)
    }
}

function image_browser_init() {
    const tab_base_tags = gradioApp().getElementById("image_browser_tab_base_tags_list")
    if (tab_base_tags) {
        const image_browser_tab_base_tags_list = tab_base_tags.querySelector("textarea").value.split(",")
        image_browser_tab_base_tags_list.forEach(function(tab_base_tag) {
            image_browser_class_add(tab_base_tag)
        })
        
        const tab_btns = gradioApp().getElementById("image_browser_tabs_container").querySelector("div").querySelectorAll("button")
        tab_btns.forEach(function(btn, i) {
            const tab_base_tag = image_browser_tab_base_tags_list[i]
            btn.setAttribute("tab_base_tag", tab_base_tag)
            btn.removeEventListener('click', () => btnClickHandler(tab_base_tag, btn))
            btn.addEventListener('click', () => btnClickHandler(tab_base_tag, btn))
        })
    }
    image_browser_keydown()
    image_browser_touch()
}

async function image_browser_wait_for_gallery_btn(tab_base_tag){ 
    await image_browser_delay(100)
    while (!gradioApp().getElementById(image_browser_current_tab() + "_image_browser_gallery").getElementsByClassName("thumbnail-item")) {
        await image_browser_delay(200)
    }
}

function image_browser_renew_page(tab_base_tag) {
    gradioApp().getElementById(tab_base_tag + '_image_browser_renew_page').click()
}

function image_browser_start() {
    image_browser_init()
    const mutationObserver = new MutationObserver(function(mutationsList) {
        const tab_base_tags = gradioApp().getElementById("image_browser_tab_base_tags_list")
        if (tab_base_tags) {
            const image_browser_tab_base_tags_list = tab_base_tags.querySelector("textarea").value.split(",")
            image_browser_tab_base_tags_list.forEach(function(tab_base_tag) {
                image_browser_class_add(tab_base_tag)
                const tab_gallery_items = gradioApp().querySelectorAll('#' + tab_base_tag + '_image_browser .thumbnail-item')
                tab_gallery_items.forEach(function(gallery_item) {
                    gallery_item.removeEventListener('click', image_browser_click_image, true)
                    gallery_item.addEventListener('click', image_browser_click_image, true)
                    document.onkeyup = async function(e) {
                        if (!image_browser_active()) {
                            return
                        }
                        const current_tab = image_browser_current_tab()
                        image_browser_wait_for_gallery_btn(current_tab).then(() => {
                            let gallery_btn
                            gallery_btn = gradioApp().getElementById(current_tab + "_image_browser_gallery").querySelector(".thumbnail-item .selected")
                            gallery_btn = gallery_btn && gallery_btn.length > 0 ? gallery_btn[0] : null
                            if (gallery_btn) {
                                image_browser_click_image.call(gallery_btn)
                            }
                        })
                    }
                })

                const cls_btn = gradioApp().getElementById(tab_base_tag + '_image_browser_gallery').querySelector("svg")
                if (cls_btn) {
                    cls_btn.removeEventListener('click', () => image_browser_renew_page(tab_base_tag), false)
                    cls_btn.addEventListener('click', () => image_browser_renew_page(tab_base_tag), false)
                }
            })
        }
    })
    mutationObserver.observe(gradioApp(), { childList:true, subtree:true })
    image_browser_started = true
    image_browser_activate_controls()
}

async function image_browser_activate_controls() {
    await image_browser_delay(500)
    container = gradioApp().getElementById("image_browser_tabs_container")
    let controls = container.querySelectorAll('[id*="_control_"]')
    controls.forEach(function(control) {
        control.style.pointerEvents = "auto"
        control.style.cursor = "default"
        control.style.opacity = "1"
    })
    let warnings = container.querySelectorAll('[id*="_warning_box"]')
    warnings.forEach(function(warning) {
        warning.innerHTML = "<p>&nbsp"
    })
}

function image_browser_current_tab() {
    const tabs = gradioApp().getElementById("image_browser_tabs_container").querySelectorAll('[id$="_image_browser_container"]')
    const tab_base_tags = gradioApp().getElementById("image_browser_tab_base_tags_list")
    const image_browser_tab_base_tags_list = tab_base_tags.querySelector("textarea").value.split(",").sort((a, b) => b.length - a.length)
    for (const element of tabs) {
      if (element.style.display === "block") {
        const id = element.id
        const tab_base_tag = image_browser_tab_base_tags_list.find(element => id.startsWith(element)) || null
        return tab_base_tag
      }
    }
}

function image_browser_active() {
    const ext_active = gradioApp().getElementById("tab_image_browser")
    return ext_active && ext_active.style.display !== "none"
}

function image_browser_keydown() {
    gradioApp().addEventListener("keydown", function(event) {
        // If we are not on the Image Browser Extension, dont listen for keypresses
        if (!image_browser_active()) {
            return
        }

        // If the user is typing in an input field, dont listen for keypresses
        let target
        if (!event.composed) { // We shouldn't get here as the Shadow DOM is always active, but just in case
            target = event.target
        } else {
            target = event.composedPath()[0]
        }
        if (!target || target.nodeName === "INPUT" || target.nodeName === "TEXTAREA") {
        return
        }

        const tab_base_tag = image_browser_current_tab()

        // Listens for keypresses 0-5 and updates the corresponding ranking (0 is the last option, None)
        if (event.code >= "Digit0" && event.code <= "Digit5") {
            const selectedValue = event.code.charAt(event.code.length - 1)
            const radioInputs = gradioApp().getElementById(tab_base_tag + "_control_image_browser_ranking").getElementsByTagName("input")
            for (const input of radioInputs) {
                if (input.value === selectedValue || (selectedValue === '0' && input === radioInputs[radioInputs.length - 1])) {
                    input.checked = true
                    input.dispatchEvent(new Event("change"))
                    break
                }
            }
        }

        const mod_keys = gradioApp().querySelector(`#${tab_base_tag}_image_browser_mod_keys textarea`).value
        let modifiers_pressed = false
        if (mod_keys.indexOf("C") !== -1 && mod_keys.indexOf("S") !== -1) {
            if (event.ctrlKey && event.shiftKey) {
                modifiers_pressed = true
            }
        } else if (mod_keys.indexOf("S") !== -1) {
            if (!event.ctrlKey && event.shiftKey) {
                modifiers_pressed = true
            }
        } else {
            if (event.ctrlKey && !event.shiftKey) {
                modifiers_pressed = true
            }
        }

        let modifiers_none = false
        if (!event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
            modifiers_none = true
        }

        if (event.code == "KeyF" && modifiers_none) {
            if (tab_base_tag == "image_browser_tab_favorites") {
                return
            }
            const favoriteBtn = gradioApp().getElementById(tab_base_tag + "_image_browser_favorites_btn")
            favoriteBtn.dispatchEvent(new Event("click"))
        }

        if (event.code == "KeyR" && modifiers_none) {
            const refreshBtn = gradioApp().getElementById(tab_base_tag + "_image_browser_renew_page")
            refreshBtn.dispatchEvent(new Event("click"))
        }

        if (event.code == "Delete" && modifiers_none) {
            const deleteBtn = gradioApp().getElementById(tab_base_tag + "_image_browser_del_img_btn")
            deleteBtn.dispatchEvent(new Event("click"))
        }

        if (event.code == "ArrowLeft" && modifiers_pressed) {
            const prevBtn = gradioApp().getElementById(tab_base_tag + "_control_image_browser_prev_page")
            prevBtn.dispatchEvent(new Event("click"))
        }

        if (event.code == "ArrowLeft" && modifiers_none) {
            const tab_base_tag = image_browser_current_tab()
            const set_btn = gradioApp().querySelector(`#${tab_base_tag}_image_browser .image_browser_set_index`)
            const curr_idx = parseInt(set_btn.getAttribute("img_index"))
            set_btn.setAttribute("img_index", curr_idx - 1)
            image_browser_refresh_current_page_preview()
        }
        
        if (event.code == "ArrowRight" && modifiers_pressed) {
            const nextBtn = gradioApp().getElementById(tab_base_tag + "_control_image_browser_next_page")
            nextBtn.dispatchEvent(new Event("click"))
        }

        if (event.code == "ArrowRight" && modifiers_none) {
            const tab_base_tag = image_browser_current_tab()
            const set_btn = gradioApp().querySelector(`#${tab_base_tag}_image_browser .image_browser_set_index`)
            const curr_idx = parseInt(set_btn.getAttribute("img_index"))
            set_btn.setAttribute("img_index", curr_idx + 1)
            image_browser_refresh_current_page_preview()
        }
    })
}

function image_browser_touch() {
    let touchStartX = 0
    let touchEndX = 0
    gradioApp().addEventListener("touchstart", function(event) {
        if (!image_browser_active()) {
            return
        }
        touchStartX = event.touches[0].clientX;
    })
    gradioApp().addEventListener("touchend", function(event) {
        if (!image_browser_active()) {
            return
        }
        touchEndX = event.changedTouches[0].clientX
        const touchDiffX = touchStartX - touchEndX
        if (touchDiffX > 50) {
            const tab_base_tag = image_browser_current_tab()
            const set_btn = gradioApp().querySelector(`#${tab_base_tag}_image_browser .image_browser_set_index`)
            const curr_idx = parseInt(set_btn.getAttribute("img_index"))
            if (curr_idx >= 1) {
                set_btn.setAttribute("img_index", curr_idx - 1)
                image_browser_refresh_current_page_preview()
            }
        } else if (touchDiffX < -50) {
            const tab_base_tag = image_browser_current_tab()
            const gallery = gradioApp().querySelector(`#${tab_base_tag}_image_browser`)
            const gallery_items = gallery.querySelectorAll(".thumbnail-item")
            const thumbnails = gallery_items.length / 2
            const set_btn = gradioApp().querySelector(`#${tab_base_tag}_image_browser .image_browser_set_index`)
            const curr_idx = parseInt(set_btn.getAttribute("img_index"))
            if (curr_idx + 1 < thumbnails) {
                set_btn.setAttribute("img_index", curr_idx + 1)
                image_browser_refresh_current_page_preview()
            }
        }
    })
}
